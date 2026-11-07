import { z } from "zod";
import {
  extractFieldSchema,
  selectorSchema,
  type ExtractField,
  type Selector,
  type Step,
} from "./definition";
import { buildApiMatch, type ApiCandidate } from "./api-match";
import type { NetworkEntry } from "./network";
import { normalizeOutputKey, uniqueOutputKey, validateStructuredField } from "./outputs";

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

export type ApiCaptureStep = Extract<NewCaptureStep, { type: "extractApi" }>;

export type CaptureBuildResult =
  | { ok: true; step: NewCaptureStep }
  | { ok: false; error: string };

function outputKeysInSteps(steps: Step[]): string[] {
  const keys: string[] = [];
  for (const step of steps) {
    if (step.type === "extract") keys.push(step.outputKey);
    if (step.type === "extractStructured") keys.push(step.root.key);
    if (step.type === "extractApi") keys.push(step.outputKey);
  }
  return keys;
}

const SAFE_REQUEST_HEADERS = new Set(["accept", "content-type", "x-requested-with"]);
const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const AUTH_LIKE = /(login|signin|sign-in|auth|token|session|password|credential)/i;

function safeRequestHeaders(entry: NetworkEntry): { name: string; value: string }[] {
  const headers = entry.requestHeaders ?? {};
  return Object.entries(headers)
    .filter(([name]) => SAFE_REQUEST_HEADERS.has(name.toLowerCase()))
    .map(([name, value]) => ({ name, value }));
}

function bodyTypeFor(entry: NetworkEntry): "json" | "form" | "text" {
  const contentType = (entry.requestHeaders?.["content-type"] ?? "").toLowerCase();
  if (contentType.includes("json")) return "json";
  if (contentType.includes("form")) return "form";
  return "text";
}

export type ApiCaptureInput = {
  candidate: ApiCandidate;
  entry: NetworkEntry;
  container: { selectors: Selector[]; name?: string; tag?: string };
  fallback?: ExtractField;
  fallbackSelectors?: Selector[];
};

/** Builds an `extractApi` step from a matched network response. */
export function buildApiCaptureStep(
  input: ApiCaptureInput,
  existingSteps: Step[],
): ApiCaptureStep {
  const used = outputKeysInSteps(existingSteps);
  const { candidate, entry, container } = input;
  const name = container.name || container.tag || "data";
  const outputKey = uniqueOutputKey(normalizeOutputKey(name, "data"), used);
  const rawMethod = (entry.method || "GET").toUpperCase();
  const method = (ALLOWED_METHODS.has(rawMethod) ? rawMethod : "GET") as
    | "GET"
    | "POST"
    | "PUT"
    | "PATCH"
    | "DELETE";
  const authLike = AUTH_LIKE.test(entry.url);

  return {
    type: "extractApi",
    outputKey,
    label: `Extract ${name} (API)`,
    request: {
      method,
      url: entry.url.slice(0, 4000),
      headers: authLike ? [] : safeRequestHeaders(entry),
      body: authLike ? undefined : entry.requestBody?.slice(0, 20_000),
      bodyType: bodyTypeFor(entry),
    },
    match: buildApiMatch(entry),
    path: candidate.path,
    shape: candidate.shape,
    keySource: "response",
    flatten: true,
    dropEmpty: true,
    joinKey: candidate.joinKey,
    fields: candidate.fields,
    limit: 500,
    container: input.fallbackSelectors?.length ? input.fallbackSelectors : container.selectors,
    fallback: input.fallback,
  };
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
