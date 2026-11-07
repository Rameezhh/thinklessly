import type { Browser, BrowserContext, Page } from "playwright";
import { z } from "zod";
import { isHttpUrl, type Field, type Step } from "@shared/definition";
import { autoPayloadFields } from "@shared/fields";
import { RecorderCore } from "@shared/recorder-core";
import type { WebSocket } from "ws";
import { openBrowser, type BrowserSession } from "../browser/launch";
import { NetworkCollector } from "../network/collector";
import { extractStructured } from "../runner/structured";
import { resolveLocator } from "../runner/selectors";
import { captureApiStep } from "./api-capture";
import { buildInferScript } from "./infer";
import { buildRecorderScript } from "./script";
import { buildSectionsScript } from "./sections";
import { buildToolbarScript } from "./toolbar";

const MAX_STEPS = 250;
const NAVIGATION_DELAY_MS = 500;
const NAVIGATION_AFTER_EVENT_MS = 5000;

const captureEnvelopeSchema = z.object({
  payload: z.unknown(),
  selectionId: z.string().max(100).optional(),
});

type RecorderStatus = "starting" | "recording" | "stopping" | "stopped";

type SessionSnapshot = {
  sessionId: string;
  status: RecorderStatus;
  startUrl: string;
  captureData: boolean;
  fields: Field[];
  steps: Step[];
  previews: Record<string, unknown>;
  previewTotals: Record<string, number>;
};

export class RecorderSession {
  readonly id: string;
  readonly startUrl: string;
  readonly captureData: boolean;

  private status: RecorderStatus = "starting";
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private browserSession: BrowserSession | null = null;
  private network: NetworkCollector | null = null;
  private clients = new Set<WebSocket>();
  private core = new RecorderCore(MAX_STEPS);
  private lastNavigationUrl = "";
  private lastInteractionAt = 0;
  private pendingNavigationUrl = "";
  private navigationTimer: ReturnType<typeof setTimeout> | undefined;
  private previews: Record<string, unknown> = {};
  private previewTotals: Record<string, number> = {};

  constructor(id: string, startUrl: string, options: { captureData?: boolean } = {}) {
    this.id = id;
    this.startUrl = startUrl;
    this.captureData = options.captureData ?? false;
  }

  async start(): Promise<void> {
    this.browserSession = await openBrowser({
      headless: false,
      profileKey: "recorder",
      viewport: null,
      extraArgs: ["--start-maximized"],
    });
    this.browser = this.browserSession.browser ?? null;
    this.context = this.browserSession.context;
    this.network = new NetworkCollector(this.context);
    this.context.on("page", (page) => this.attachPage(page));
    this.context.on("close", () => {
      if (this.status === "recording" || this.status === "starting") {
        this.status = "stopped";
        this.broadcast({ type: "stopped", ...this.snapshot() });
      }
    });
    await this.context.exposeBinding("__thinklesslyRecord", (_source, payload) => {
      this.handleEvent(payload);
    });
    if (this.captureData) {
      await this.context.exposeBinding("__thinklesslyCapture", (source, payload) => {
        void this.handleCapture(payload, source.page);
      });
      await this.context.exposeBinding("__thinklesslyRemove", (_source, selectionId) => {
        if (typeof selectionId === "string") this.removeCaptureStep(selectionId);
      });
    }
    const scripts = [buildRecorderScript()];
    if (this.captureData) scripts.push(buildInferScript(), buildSectionsScript(), buildToolbarScript());
    await this.context.addInitScript({ content: scripts.join("\n") });

    this.browser?.on("disconnected", () => {
      if (this.status === "recording" || this.status === "starting") {
        this.status = "stopped";
        this.broadcast({ type: "stopped", ...this.snapshot() });
      }
    });

    const page = this.context.pages()[0] ?? (await this.context.newPage());
    await page.goto(this.startUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await this.ensureRecorderScripts(page);
    this.lastNavigationUrl = page.url();
    this.pushStep({ type: "goto", url: this.startUrl, label: `Go to ${this.startUrl}` });
    this.status = "recording";
  }

  snapshot(): SessionSnapshot {
    return {
      sessionId: this.id,
      status: this.status,
      startUrl: this.startUrl,
      captureData: this.captureData,
      fields: this.core.fields,
      steps: this.core.steps,
      previews: this.previews,
      previewTotals: this.previewTotals,
    };
  }

  addClient(client: WebSocket): void {
    this.clients.add(client);
    client.send(JSON.stringify({ type: "snapshot", ...this.snapshot() }));
  }

  removeClient(client: WebSocket): void {
    this.clients.delete(client);
  }

  closeClients(): void {
    for (const client of this.clients) client.close();
    this.clients.clear();
  }

  async stop(): Promise<SessionSnapshot> {
    if (this.status === "stopped") return this.snapshot();
    if (this.status === "starting") throw new Error("The recording browser is still starting.");
    if (this.status === "stopping") throw new Error("The recording is already stopping.");

    for (const page of this.context?.pages() ?? []) {
      await page
        .evaluate(() => {
          const scope = window as unknown as { __thinklesslyFlush?: () => void };
          scope.__thinklesslyFlush?.();
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        })
        .catch(() => undefined);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));

    if (this.navigationTimer) clearTimeout(this.navigationTimer);
    const activePage = this.context?.pages().find((page) => isHttpUrl(page.url()));
    this.recordNavigation(this.pendingNavigationUrl || activePage?.url() || "");
    this.pendingNavigationUrl = "";
    this.status = "stopping";

    await this.browserSession?.close();
    this.browserSession = null;
    this.context = null;
    this.browser = null;

    const normalized = autoPayloadFields(this.core.fields, this.core.steps);
    this.core.fields = normalized.fields;
    this.core.steps = normalized.steps;

    this.status = "stopped";
    this.broadcast({ type: "stopped", ...this.snapshot() });
    return this.snapshot();
  }

  async shutdown(): Promise<void> {
    if (this.status === "stopped") return;
    this.status = "stopping";
    if (this.navigationTimer) clearTimeout(this.navigationTimer);
    await this.browserSession?.close();
    this.browserSession = null;
    this.context = null;
    this.browser = null;
    this.status = "stopped";
    this.closeClients();
  }

  private attachPage(page: Page): void {
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) this.scheduleNavigation(page.url());
    });
    page.on("domcontentloaded", () => {
      void this.ensureRecorderScripts(page);
    });
  }

  private async ensureRecorderScripts(page: Page): Promise<void> {
    if (!this.captureData) return;
    for (const content of [buildRecorderScript(), buildInferScript(), buildSectionsScript(), buildToolbarScript()]) {
      try {
        await page.evaluate(content);
      } catch {
        // The page may be navigating or may reject script evaluation.
      }
    }
  }

  private scheduleNavigation(url: string): void {
    if (!isHttpUrl(url) || this.status !== "recording") return;
    this.pendingNavigationUrl = url;
    if (this.navigationTimer) clearTimeout(this.navigationTimer);
    this.navigationTimer = setTimeout(() => {
      this.recordNavigation(this.pendingNavigationUrl);
    }, NAVIGATION_DELAY_MS);
  }

  private recordNavigation(url: string): void {
    if (!url || !isHttpUrl(url) || this.status === "stopping" || this.status === "stopped") return;
    if (url === this.lastNavigationUrl) return;

    this.lastNavigationUrl = url;
    if (Date.now() - this.lastInteractionAt < NAVIGATION_AFTER_EVENT_MS) return;
    this.pushStep({ type: "goto", url, label: `Go to ${url}` });
  }

  private pushStep(step: Parameters<RecorderCore["pushStep"]>[0]): Step | null {
    const result = this.core.pushStep(step);
    if (!result) return null;
    this.broadcast(result.updated ? { type: "step-updated", step: result.step } : { type: "step", step: result.step });
    return result.step;
  }

  private removeCaptureStep(selectionId: string): void {
    const stepId = this.core.removeCapture(selectionId);
    if (!stepId) return;
    delete this.previews[stepId];
    delete this.previewTotals[stepId];
    this.broadcast({ type: "snapshot", ...this.snapshot() });
  }

  private async handleCapture(input: unknown, page: Page): Promise<void> {
    if (this.status !== "recording") return;
    const envelope = captureEnvelopeSchema.safeParse(input);
    const payload = envelope.success ? envelope.data.payload : input;
    const selectionId = envelope.success ? envelope.data.selectionId : undefined;

    const apiStep = await this.tryApiCapture(payload, page, selectionId);
    if (apiStep) return;

    const outcome = this.core.handleCapture(payload, selectionId);
    if (!outcome.ok) {
      this.broadcast({ type: "capture-error", error: outcome.error });
      return;
    }

    this.lastInteractionAt = Date.now();
    const step = outcome.result.step;
    this.broadcast(
      outcome.result.updated ? { type: "step-updated", step } : { type: "step", step },
    );

    if (step.type !== "extractStructured") return;
    try {
      const { locator } = await resolveLocator(page, step.selectors, 3000, () => undefined, step.id);
      const full = await extractStructured(locator, step.root, { maxItems: 500, maxText: 1000 });
      const total = Array.isArray(full) ? full.length : undefined;
      this.previews[step.id] = full;
      if (typeof total === "number") this.previewTotals[step.id] = total;
      this.broadcast({ type: "preview", stepId: step.id, preview: full, total });
    } catch {
      this.broadcast({ type: "preview", stepId: step.id, preview: null });
    }
  }

  /** Tries to turn a DOM selection into an API-backed step. Returns true on success. */
  private async tryApiCapture(payload: unknown, page: Page, selectionId?: string): Promise<boolean> {
    if (!this.network || !this.captureData) return false;
    const result = await captureApiStep({
      core: this.core,
      network: this.network,
      payload,
      page,
      selectionId,
    });
    if (!result) return false;

    this.lastInteractionAt = Date.now();
    this.broadcast(
      result.pushed.updated
        ? { type: "step-updated", step: result.pushed.step, api: result.api }
        : { type: "step", step: result.pushed.step, api: result.api },
    );

    const preview = result.preview;
    const total = Array.isArray(preview) ? preview.length : undefined;
    this.previews[result.pushed.step.id] = preview;
    if (typeof total === "number") this.previewTotals[result.pushed.step.id] = total;
    this.broadcast({ type: "preview", stepId: result.pushed.step.id, preview, total });
    return true;
  }

  private handleEvent(payload: unknown): void {
    if (this.status !== "recording") return;
    const result = this.core.handleEvent(payload);
    if (!result) return;
    this.lastInteractionAt = Date.now();
    this.broadcast(result.updated ? { type: "step-updated", step: result.step } : { type: "step", step: result.step });
  }

  private broadcast(message: Record<string, unknown>): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === 1) client.send(data);
    }
  }
}
