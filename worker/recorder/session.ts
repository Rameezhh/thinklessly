import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { z } from "zod";
import { isHttpUrl, selectorSchema, type Field, type Selector, type Step } from "@shared/definition";
import type { WebSocket } from "ws";
import { extractStructured } from "../runner/structured";
import { resolveLocator } from "../runner/selectors";
import { buildCaptureStep } from "./capture";
import { buildInferScript } from "./infer";
import { buildRecorderScript } from "./script";
import { buildSectionsScript } from "./sections";
import { buildToolbarScript } from "./toolbar";

const MAX_STEPS = 250;
const NAVIGATION_DELAY_MS = 500;
const NAVIGATION_AFTER_EVENT_MS = 5000;

const selectorListSchema = z.array(selectorSchema).min(1).max(20);

const elementSchema = z.object({
  selectors: selectorListSchema,
  name: z.string().max(200).default(""),
  tag: z.string().max(40).default(""),
  inputType: z.string().max(40).default(""),
  fieldKey: z.string().max(60).default(""),
});

const captureEnvelopeSchema = z.object({
  payload: z.unknown(),
  selectionId: z.string().max(100).optional(),
});

const eventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("click"), element: elementSchema }),
  z.object({
    kind: z.literal("fill"),
    element: elementSchema,
    value: z.string().max(50_000).default(""),
    secret: z.boolean().default(false),
  }),
  z.object({ kind: z.literal("select"), element: elementSchema, value: z.string().max(10_000) }),
  z.object({ kind: z.literal("check"), element: elementSchema, checked: z.boolean() }),
  z.object({ kind: z.literal("upload"), element: elementSchema }),
  z.object({ kind: z.literal("press"), element: elementSchema, key: z.string().min(1).max(40) }),
]);

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

type DraftStep<T> = T extends Step
  ? Omit<T, "id" | "enabled" | "optional"> & Partial<Pick<T, "id" | "enabled" | "optional">>
  : never;
type NewStep = DraftStep<Step>;

function safeLabel(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}

function isTransientElement(name: string, selectors: Selector[]): boolean {
  const haystack = `${name} ${selectors
    .map((selector) => `${selector.kind} ${selector.value} ${selector.name ?? ""}`)
    .join(" ")}`.toLowerCase();
  if (/(overlay|modal|backdrop|popup|dialog)/.test(haystack)) return true;
  return /(^|[\s_-])(close|dismiss|not now|no thanks|maybe later|got it)([\s_-]|$)/.test(haystack);
}

function fieldKeyBase(value: string, fallback: string): string {
  const key = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return /^[a-z]/.test(key) ? key : fallback;
}

export class RecorderSession {
  readonly id: string;
  readonly startUrl: string;
  readonly captureData: boolean;

  private status: RecorderStatus = "starting";
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private clients = new Set<WebSocket>();
  private fields: Field[] = [];
  private steps: Step[] = [];
  private captureStepIds = new Map<string, string>();
  private nextStepNumber = 1;
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
    this.browser = await chromium.launch({ headless: false, args: ["--start-maximized"] });
    this.context = await this.browser.newContext({ viewport: null });
    this.context.on("page", (page) => this.attachPage(page));
    await this.context.exposeBinding("__webtomateRecord", (_source, payload) => {
      this.handleEvent(payload);
    });
    if (this.captureData) {
      await this.context.exposeBinding("__webtomateCapture", (source, payload) => {
        void this.handleCapture(payload, source.page);
      });
      await this.context.exposeBinding("__webtomateRemove", (_source, selectionId) => {
        if (typeof selectionId === "string") this.removeCaptureStep(selectionId);
      });
    }
    const scripts = [buildRecorderScript()];
    if (this.captureData) scripts.push(buildInferScript(), buildSectionsScript(), buildToolbarScript());
    await this.context.addInitScript({ content: scripts.join("\n") });

    this.browser.on("disconnected", () => {
      if (this.status === "recording" || this.status === "starting") {
        this.status = "stopped";
        this.broadcast({ type: "stopped", ...this.snapshot() });
      }
    });

    const page = await this.context.newPage();
    await page.goto(this.startUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await this.ensureRecorderScripts(page);
    this.lastNavigationUrl = page.url();
    this.pushStep({
      type: "goto",
      url: this.startUrl,
      label: `Go to ${this.startUrl}`,
    });
    this.status = "recording";
  }

  snapshot(): SessionSnapshot {
    return {
      sessionId: this.id,
      status: this.status,
      startUrl: this.startUrl,
      captureData: this.captureData,
      fields: this.fields,
      steps: this.steps,
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
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        })
        .catch(() => undefined);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (this.navigationTimer) clearTimeout(this.navigationTimer);
    this.recordNavigation(this.pendingNavigationUrl || this.context?.pages()[0]?.url() || "");
    this.pendingNavigationUrl = "";
    this.status = "stopping";

    await this.context?.close().catch(() => undefined);
    await this.browser?.close().catch(() => undefined);
    this.context = null;
    this.browser = null;
    this.status = "stopped";
    this.broadcast({ type: "stopped", ...this.snapshot() });
    return this.snapshot();
  }

  async shutdown(): Promise<void> {
    if (this.status === "stopped") return;
    this.status = "stopping";
    if (this.navigationTimer) clearTimeout(this.navigationTimer);
    await this.context?.close().catch(() => undefined);
    await this.browser?.close().catch(() => undefined);
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

  private materializeStep(step: NewStep): Step {
    return {
      ...step,
      id: step.id ?? `step-${this.nextStepNumber++}`,
      enabled: step.enabled ?? true,
      optional: step.optional ?? false,
    } as Step;
  }

  private pushStep(step: NewStep): Step | null {
    if (this.steps.length >= MAX_STEPS) return null;
    const full = this.materializeStep(step);
    this.steps.push(full);
    this.broadcast({ type: "step", step: full });
    return full;
  }

  private removeCaptureStep(selectionId: string): void {
    const stepId = this.captureStepIds.get(selectionId);
    if (!stepId) return;
    this.captureStepIds.delete(selectionId);
    this.steps = this.steps.filter((step) => step.id !== stepId);
    delete this.previews[stepId];
    delete this.previewTotals[stepId];
    this.broadcast({ type: "snapshot", ...this.snapshot() });
  }

  private async handleCapture(input: unknown, page: Page): Promise<void> {
    if (this.status !== "recording") return;
    const envelope = captureEnvelopeSchema.safeParse(input);
    const payload = envelope.success ? envelope.data.payload : input;
    const selectionId = envelope.success ? envelope.data.selectionId : undefined;

    const result = buildCaptureStep(payload, this.steps);
    if (!result.ok) {
      this.broadcast({ type: "capture-error", error: result.error });
      return;
    }

    this.lastInteractionAt = Date.now();
    const step = this.pushStep(result.step);
    if (!step) {
      this.broadcast({ type: "capture-error", error: `Step limit of ${MAX_STEPS} reached.` });
      return;
    }
    if (selectionId) this.captureStepIds.set(selectionId, step.id);

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

  private ensureField(keyHint: string, label: string, type: Field["type"], secret: boolean): string {
    const fallback = type === "file" ? "upload_file" : "password";
    const base = fieldKeyBase(keyHint, fallback);
    const existing = this.fields.find((field) => field.key === base);
    if (existing) return existing.key;

    let key = base;
    let suffix = 2;
    while (this.fields.some((field) => field.key === key)) {
      key = `${base}_${suffix}`;
      suffix += 1;
    }

    this.fields.push({
      key,
      label: safeLabel(label) || (type === "file" ? "Upload file" : "Password"),
      type,
      secret,
      required: true,
    });
    return key;
  }

  private handleEvent(payload: unknown): void {
    if (this.status !== "recording") return;
    const parsed = eventSchema.safeParse(payload);
    if (!parsed.success) return;
    const event = parsed.data;
    const element = event.element;
    if (!element.selectors.length) return;

    const name = safeLabel(element.name) || element.tag || "element";
    this.lastInteractionAt = Date.now();

    const step = this.buildEventStep(event, element, name);
    if (!step) return;
    this.pushStep(step);
  }

  private buildEventStep(
    event: z.infer<typeof eventSchema>,
    element: z.infer<typeof elementSchema>,
    name: string,
  ): NewStep | null {
    switch (event.kind) {
      case "click": {
        const optional = isTransientElement(name, element.selectors);
        return { type: "click", selectors: element.selectors, label: `Click ${name}`, optional };
      }
      case "fill": {
        if (event.secret) {
          const key = this.ensureField(element.fieldKey, name, "password", true);
          return {
            type: "fill",
            selectors: element.selectors,
            value: { mode: "field", key },
            label: `Fill ${name} (secret)`,
          };
        }
        return {
          type: "fill",
          selectors: element.selectors,
          value: { mode: "literal", text: event.value },
          label: `Fill ${name}`,
        };
      }
      case "select":
        return { type: "select", selectors: element.selectors, value: event.value, label: `Select ${name}` };
      case "check":
        return {
          type: "check",
          selectors: element.selectors,
          checked: event.checked,
          label: `${event.checked ? "Check" : "Uncheck"} ${name}`,
        };
      case "upload": {
        const key = this.ensureField(element.fieldKey, name, "file", false);
        return { type: "upload", selectors: element.selectors, fieldKey: key, label: `Upload ${name}` };
      }
      case "press":
        return { type: "press", selectors: element.selectors, key: event.key, label: `Press ${event.key}` };
    }
  }

  private broadcast(message: Record<string, unknown>): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === 1) client.send(data);
    }
  }
}
