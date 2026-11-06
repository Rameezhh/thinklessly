import { findElementBySelectors, extractStructuredInDom, readElementAttribute } from "@/lib/live/dom-extract";
import { isHttpUrl, type Field, type Step } from "@shared/definition";
import { RecorderCore } from "@shared/recorder-core";

export type LiveSnapshot = {
  fields: Field[];
  steps: Step[];
  previews: Record<string, unknown>;
  previewTotals: Record<string, number>;
};

type BridgeMessage =
  | { __thinklessly: "record"; payload: unknown }
  | { __thinklessly: "capture"; payload: { payload: unknown; selectionId?: string } }
  | { __thinklessly: "remove"; id: string };

export type LiveError = { message: string };

function normalizeUrl(value: string): string {
  try {
    return new URL(value).toString();
  } catch {
    return value;
  }
}

/**
 * Browser-side recorder state. Mirrors the worker RecorderSession but derives
 * everything from messages posted by the recorder scripts running inside the
 * proxied iframe. Previews are extracted from the live DOM so they match the
 * Playwright runner's output.
 */
export class LiveRecorderSession {
  readonly core = new RecorderCore();
  readonly previews: Record<string, unknown> = {};
  readonly previewTotals: Record<string, number> = {};

  private listeners = new Set<(snapshot: LiveSnapshot) => void>();
  private errorListeners = new Set<(error: LiveError) => void>();
  private lastNavigationUrl = "";
  private lastInteractionAt = 0;
  private pendingNavigationUrl = "";
  private navigationTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly getDocument: () => Document | null) {}

  begin(startUrl: string): void {
    const url = normalizeUrl(startUrl);
    this.lastNavigationUrl = url;
    this.core.pushStep({ type: "goto", url, label: `Go to ${url}` });
    this.emit();
  }

  scheduleNavigation(url: string): void {
    if (!isHttpUrl(url)) return;
    this.pendingNavigationUrl = url;
    if (this.navigationTimer) clearTimeout(this.navigationTimer);
    this.navigationTimer = setTimeout(() => this.recordNavigation(this.pendingNavigationUrl), 500);
  }

  stop(): void {
    if (this.navigationTimer) clearTimeout(this.navigationTimer);
    this.navigationTimer = undefined;
  }

  private recordNavigation(url: string): void {
    if (!url || !isHttpUrl(url)) return;
    const normalized = normalizeUrl(url);
    if (normalized === this.lastNavigationUrl) return;
    this.lastNavigationUrl = normalized;
    if (Date.now() - this.lastInteractionAt < 5000) return;
    this.core.pushStep({ type: "goto", url: normalized, label: `Go to ${normalized}` });
    this.emit();
  }

  subscribe(listener: (snapshot: LiveSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onError(listener: (error: LiveError) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  snapshot(): LiveSnapshot {
    return {
      fields: this.core.fields,
      steps: this.core.steps,
      previews: this.previews,
      previewTotals: this.previewTotals,
    };
  }

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }

  handleMessage(data: unknown): void {
    if (!data || typeof data !== "object") return;
    const message = data as Partial<BridgeMessage>;
    if (message.__thinklessly === "record") {
      const result = this.core.handleEvent((message as { payload: unknown }).payload);
      if (result) {
        this.lastInteractionAt = Date.now();
        this.emit();
      }
      return;
    }
    if (message.__thinklessly === "capture") {
      const envelope = (message as { payload?: { payload?: unknown; selectionId?: string } }).payload;
      const outcome = this.core.handleCapture(envelope?.payload, envelope?.selectionId);
      if (!outcome.ok) {
        for (const listener of this.errorListeners) listener({ message: outcome.error });
        return;
      }
      this.lastInteractionAt = Date.now();
      this.capturePreview(outcome.result.step);
      this.emit();
      return;
    }
    if (message.__thinklessly === "remove") {
      const id = (message as { id: string }).id;
      const stepId = this.core.removeCapture(id);
      if (!stepId) return;
      this.lastInteractionAt = Date.now();
      delete this.previews[stepId];
      delete this.previewTotals[stepId];
      this.emit();
    }
  }

  private capturePreview(step: Step): void {
    if (step.type !== "extract" && step.type !== "extractStructured") return;
    const document = this.getDocument();
    if (!document) return;
    const container = findElementBySelectors(document, step.selectors);
    if (!container) {
      if (step.type === "extractStructured") this.previews[step.id] = null;
      return;
    }

    if (step.type === "extract") {
      const value = readElementAttribute(container, step.attribute);
      this.previews[step.id] = value ?? null;
      return;
    }

    try {
      const full = extractStructuredInDom(container, step.root, { maxItems: 500, maxText: 1000 });
      this.previews[step.id] = full;
      if (Array.isArray(full)) this.previewTotals[step.id] = full.length;
    } catch {
      this.previews[step.id] = null;
    }
  }
}
