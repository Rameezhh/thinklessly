import { z } from "zod";
import { selectorSchema, type Field, type Selector, type Step } from "./definition";
import { buildCaptureStep } from "./recorder-capture";
import { mergeRecordedStep } from "./recorder-merge";

export const elementSchema = z.object({
  selectors: z.array(selectorSchema).min(1).max(20),
  name: z.string().max(200).default(""),
  tag: z.string().max(40).default(""),
  inputType: z.string().max(40).default(""),
  fieldKey: z.string().max(60).default(""),
  identity: z.string().max(300).default(""),
});

export const eventSchema = z.discriminatedUnion("kind", [
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

export type RecorderElement = z.infer<typeof elementSchema>;
export type RecorderEvent = z.infer<typeof eventSchema>;

export type DraftStep<T> = T extends Step
  ? Omit<T, "id" | "enabled" | "optional"> & Partial<Pick<T, "id" | "enabled" | "optional">>
  : never;
export type NewStep = DraftStep<Step>;

export type PushResult = { step: Step; updated: boolean };

export type CaptureOutcome =
  | { ok: true; result: PushResult }
  | { ok: false; error: string };

export function safeLabel(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}

export function isTransientElement(name: string, selectors: Selector[]): boolean {
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

/**
 * Pure, environment-agnostic recorder state. Used by both the server-side
 * Playwright recorder and the browser service-worker recorder so recorded
 * steps are produced identically in every environment.
 */
export class RecorderCore {
  fields: Field[] = [];
  steps: Step[] = [];

  private readonly maxSteps: number;
  private captureStepIds = new Map<string, string>();
  private fieldByTarget = new Map<string, string>();
  private nextStepNumber = 1;

  constructor(maxSteps = 250) {
    this.maxSteps = maxSteps;
  }

  private materializeStep(step: NewStep): Step {
    return {
      ...step,
      id: step.id ?? `step-${this.nextStepNumber++}`,
      enabled: step.enabled ?? true,
      optional: step.optional ?? false,
    } as Step;
  }

  pushStep(step: NewStep): PushResult | null {
    const full = this.materializeStep(step);
    const result = mergeRecordedStep(this.steps, full);
    if (result.ignored) return null;
    const isNew = !result.updated;

    if (isNew && this.steps.length >= this.maxSteps) return null;

    this.steps = result.steps;
    const merged = this.steps.find((entry) => entry.id === result.stepId) ?? full;
    return { step: merged, updated: !isNew };
  }

  /** Pushes an already-built step (for example an API capture) and tracks it. */
  pushCapture(step: NewStep, selectionId?: string): PushResult | null {
    const pushed = this.pushStep(step);
    if (pushed && selectionId) this.captureStepIds.set(selectionId, pushed.step.id);
    return pushed;
  }

  handleEvent(payload: unknown): PushResult | null {
    const parsed = eventSchema.safeParse(payload);
    if (!parsed.success) return null;
    const event = parsed.data;
    const element = event.element;
    if (!element.selectors.length) return null;

    const name = safeLabel(element.name) || element.tag || "element";
    const step = this.buildEventStep(event, element, name);
    if (!step) return null;
    return this.pushStep(step);
  }

  handleCapture(payload: unknown, selectionId?: string): CaptureOutcome {
    const result = buildCaptureStep(payload, this.steps);
    if (!result.ok) return { ok: false, error: result.error };

    const pushed = this.pushStep(result.step);
    if (!pushed) return { ok: false, error: `Step limit of ${this.maxSteps} reached.` };
    if (selectionId) this.captureStepIds.set(selectionId, pushed.step.id);
    return { ok: true, result: pushed };
  }

  removeCapture(selectionId: string): string | null {
    const stepId = this.captureStepIds.get(selectionId);
    if (!stepId) return null;
    this.captureStepIds.delete(selectionId);
    this.steps = this.steps.filter((step) => step.id !== stepId);
    return stepId;
  }

  private ensureField(
    keyHint: string,
    label: string,
    type: Field["type"],
    secret: boolean,
    identity = "",
  ): string {
    if (identity) {
      const known = this.fieldByTarget.get(identity);
      if (known) return known;
    }

    const fallback = type === "file" ? "upload_file" : "password";
    const base = fieldKeyBase(keyHint, fallback);
    const existing = this.fields.find((field) => field.key === base);
    if (existing) {
      if (identity) this.fieldByTarget.set(identity, existing.key);
      return existing.key;
    }

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
    if (identity) this.fieldByTarget.set(identity, key);
    return key;
  }

  private buildEventStep(
    event: RecorderEvent,
    element: RecorderElement,
    name: string,
  ): NewStep | null {
    const identity = element.identity || undefined;
    switch (event.kind) {
      case "click": {
        const optional = isTransientElement(name, element.selectors);
        return { type: "click", selectors: element.selectors, label: `Click ${name}`, optional, identity };
      }
      case "fill": {
        if (event.secret) {
          const key = this.ensureField(element.fieldKey, name, "password", true, element.identity);
          return {
            type: "fill",
            selectors: element.selectors,
            value: { mode: "field", key },
            label: `Fill ${name} (secret)`,
            secret: true,
            identity,
          };
        }
        return {
          type: "fill",
          selectors: element.selectors,
          value: { mode: "literal", text: event.value },
          label: `Fill ${name}`,
          secret: false,
          identity,
        };
      }
      case "select":
        return {
          type: "select",
          selectors: element.selectors,
          value: event.value,
          label: `Select ${name}`,
          identity,
        };
      case "check":
        return {
          type: "check",
          selectors: element.selectors,
          checked: event.checked,
          label: `${event.checked ? "Check" : "Uncheck"} ${name}`,
          identity,
        };
      case "upload": {
        const key = this.ensureField(element.fieldKey, name, "file", false, element.identity);
        return {
          type: "upload",
          selectors: element.selectors,
          fieldKey: key,
          label: `Upload ${name}`,
          identity,
        };
      }
      case "press":
        return {
          type: "press",
          selectors: element.selectors,
          key: event.key,
          label: `Press ${event.key}`,
          identity,
        };
    }
  }
}
