import { z } from "zod";
import { extractFieldSchema, selectorSchema, type Step } from "@shared/definition";
import { normalizeOutputKey, uniqueOutputKey, validateStructuredField } from "@shared/outputs";

const captureElementSchema = z.object({
  selectors: z.array(selectorSchema).min(1).max(20),
  name: z.string().max(200).default(""),
  tag: z.string().max(40).default(""),
});

const singleCaptureSchema = z.object({
  kind: z.literal("single"),
  element: captureElementSchema,
  attribute: z.string().min(1).max(100).default("text"),
});

const structuredCaptureSchema = z.object({
  kind: z.literal("structured"),
  container: captureElementSchema,
  root: extractFieldSchema,
});

export const capturePayloadSchema = z.discriminatedUnion("kind", [
  singleCaptureSchema,
  structuredCaptureSchema,
]);

export type CapturePayload = z.infer<typeof capturePayloadSchema>;

type DraftStep<T> = T extends Step
  ? Omit<T, "id" | "enabled" | "optional"> & Partial<Pick<T, "id" | "enabled" | "optional">>
  : never;
export type NewCaptureStep = DraftStep<Step>;

export type CaptureBuildResult =
  | { ok: true; step: NewCaptureStep }
  | { ok: false; error: string };

function outputKeysInSteps(steps: Step[]): string[] {
  const keys: string[] = [];
  for (const step of steps) {
    if (step.type === "extract") keys.push(step.outputKey);
    if (step.type === "extractStructured") keys.push(step.root.key);
  }
  return keys;
}

export function buildCaptureStep(payload: unknown, existingSteps: Step[]): CaptureBuildResult {
  const parsed = capturePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid captured data." };
  }

  const used = outputKeysInSteps(existingSteps);
  const data = parsed.data;

  if (data.kind === "single") {
    const name = data.element.name || data.element.tag || "value";
    const outputKey = uniqueOutputKey(normalizeOutputKey(name, "value"), used);
    return {
      ok: true,
      step: {
        type: "extract",
        selectors: data.element.selectors,
        attribute: data.attribute,
        outputKey,
        label: `Extract ${name}`,
      },
    };
  }

  const issues = validateStructuredField(data.root);
  if (issues.length > 0) {
    return { ok: false, error: issues[0]?.message ?? "The captured structure is invalid." };
  }

  const root = {
    ...data.root,
    key: uniqueOutputKey(normalizeOutputKey(data.root.key, "data"), used),
  };

  return {
    ok: true,
    step: {
      type: "extractStructured",
      selectors: data.container.selectors,
      root,
      label: `Extract ${data.container.name || data.container.tag || "data"}`,
    },
  };
}
