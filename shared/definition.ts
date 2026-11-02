import { z } from "zod";

export const fieldKeySchema = z
  .string()
  .min(1, "Field key is required")
  .regex(/^[a-z][a-z0-9_]*$/, "Field key must be snake_case (a-z, 0-9, _)");

export const outputKeySchema = z
  .string()
  .min(1, "Output key is required")
  .regex(/^[a-z][a-z0-9_]*$/, "Output key must be snake_case (a-z, 0-9, _)");

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const httpUrlSchema = z
  .string()
  .min(1, "URL is required")
  .refine(isHttpUrl, "URL must use http:// or https://");

const timeoutMsSchema = z.number().int().positive();

export const selectorSchema = z.object({
  kind: z.enum(["testid", "role", "label", "placeholder", "text", "css", "xpath"]),
  value: z.string().min(1, "Selector value is required"),
  name: z.string().optional(),
});
export type Selector = z.infer<typeof selectorSchema>;

const selectorsSchema = z.array(selectorSchema).min(1, "At least one selector is required");

export const fieldSchema = z.object({
  key: fieldKeySchema,
  label: z.string().min(1, "Field label is required"),
  type: z.enum(["text", "password", "email", "number", "file", "select", "checkbox"]),
  secret: z.boolean().default(false),
  required: z.boolean().default(true),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  description: z.string().optional(),
});
export type Field = z.infer<typeof fieldSchema>;

export const fillValueSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("literal"), text: z.string() }),
  z.object({ mode: z.literal("field"), key: fieldKeySchema }),
]);
export type FillValue = z.infer<typeof fillValueSchema>;

const stepBase = {
  id: z.string().min(1, "Step id is required"),
  enabled: z.boolean().default(true),
  label: z.string().optional(),
  timeoutMs: timeoutMsSchema.optional(),
  optional: z.boolean().default(false),
};

const gotoStepSchema = z.object({
  ...stepBase,
  type: z.literal("goto"),
  url: httpUrlSchema,
});

const clickStepSchema = z.object({
  ...stepBase,
  type: z.literal("click"),
  selectors: selectorsSchema,
});

const fillStepSchema = z.object({
  ...stepBase,
  type: z.literal("fill"),
  selectors: selectorsSchema,
  value: fillValueSchema,
});

const selectStepSchema = z.object({
  ...stepBase,
  type: z.literal("select"),
  selectors: selectorsSchema,
  value: z.string(),
});

const checkStepSchema = z.object({
  ...stepBase,
  type: z.literal("check"),
  selectors: selectorsSchema,
  checked: z.boolean(),
});

const uploadStepSchema = z.object({
  ...stepBase,
  type: z.literal("upload"),
  selectors: selectorsSchema,
  fieldKey: fieldKeySchema,
});

const pressStepSchema = z.object({
  ...stepBase,
  type: z.literal("press"),
  selectors: selectorsSchema.optional(),
  key: z.string().min(1, "Key is required"),
});

const waitStepSchema = z.object({
  ...stepBase,
  type: z.literal("wait"),
  kind: z.enum(["ms", "selector", "url", "networkIdle"]),
  value: z.union([z.string(), z.number()]),
});

const extractStepSchema = z.object({
  ...stepBase,
  type: z.literal("extract"),
  selectors: selectorsSchema,
  attribute: z.string().min(1).default("text"),
  outputKey: outputKeySchema,
});

export type ExtractField =
  | { kind: "value"; key: string; selector: string; attribute: string }
  | { kind: "object"; key: string; selector?: string; fields: ExtractField[] }
  | { kind: "list"; key: string; selector: string; limit: number; fields: ExtractField[] };

export const extractFieldSchema: z.ZodType<ExtractField> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("value"),
      key: outputKeySchema,
      selector: z.string().min(1).max(500),
      attribute: z.string().min(1).max(100).default("text"),
    }),
    z.object({
      kind: z.literal("object"),
      key: outputKeySchema,
      selector: z.string().min(1).max(500).optional(),
      fields: z.array(extractFieldSchema).min(1).max(100),
    }),
    z.object({
      kind: z.literal("list"),
      key: outputKeySchema,
      selector: z.string().min(1).max(500),
      limit: z.number().int().positive().max(2000).default(500),
      fields: z.array(extractFieldSchema).min(1).max(100),
    }),
  ]),
);

const extractStructuredStepSchema = z.object({
  ...stepBase,
  type: z.literal("extractStructured"),
  selectors: selectorsSchema,
  root: extractFieldSchema,
});

const screenshotStepSchema = z.object({
  ...stepBase,
  type: z.literal("screenshot"),
  name: z
    .string()
    .min(1, "Screenshot name is required")
    .regex(/^[a-zA-Z0-9._-]+$/, "Screenshot name may only contain letters, numbers, dot, dash, underscore"),
  fullPage: z.boolean().default(false),
});

const assertStepSchema = z
  .object({
    ...stepBase,
    type: z.literal("assert"),
    kind: z.enum(["visible", "text", "url"]),
    selectors: selectorsSchema.optional(),
    value: z.string().optional(),
  })
  .superRefine((step, ctx) => {
    if (step.kind === "visible" && !step.selectors) {
      ctx.addIssue({ code: "custom", path: ["selectors"], message: "Visible assertions require selectors" });
    }
    if (step.kind === "text") {
      if (!step.selectors) {
        ctx.addIssue({ code: "custom", path: ["selectors"], message: "Text assertions require selectors" });
      }
      if (step.value === undefined) {
        ctx.addIssue({ code: "custom", path: ["value"], message: "Text assertions require a value" });
      }
    }
    if (step.kind === "url" && step.value === undefined) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "URL assertions require a value" });
    }
  });

export const stepSchema = z.discriminatedUnion("type", [
  gotoStepSchema,
  clickStepSchema,
  fillStepSchema,
  selectStepSchema,
  checkStepSchema,
  uploadStepSchema,
  pressStepSchema,
  waitStepSchema,
  extractStepSchema,
  extractStructuredStepSchema,
  screenshotStepSchema,
  assertStepSchema,
]);
export type Step = z.infer<typeof stepSchema>;
export type StepType = Step["type"];

export const settingsSchema = z.object({
  viewport: z
    .object({ width: z.number().int().positive(), height: z.number().int().positive() })
    .optional(),
  userAgent: z.string().optional(),
  locale: z.string().optional(),
  timezone: z.string().optional(),
  stepTimeoutMs: timeoutMsSchema.default(15000),
  runTimeoutMs: timeoutMsSchema.default(300000),
  allowHumanHelp: z.boolean().default(true),
});
export type Settings = z.infer<typeof settingsSchema>;

function checkExtractFieldKeys(
  fields: ExtractField[],
  path: (string | number)[],
  ctx: z.RefinementCtx,
): void {
  const keys = new Set<string>();
  fields.forEach((field, index) => {
    if (keys.has(field.key)) {
      ctx.addIssue({
        code: "custom",
        path: [...path, index, "key"],
        message: `Duplicate output field key "${field.key}"`,
      });
    }
    keys.add(field.key);
    if (field.kind !== "value") {
      checkExtractFieldKeys(field.fields, [...path, index, "fields"], ctx);
    }
  });
}

export const automationDefinitionSchema = z
  .object({
    version: z.number().int().positive(),
    startUrl: httpUrlSchema,
    fields: z.array(fieldSchema).default([]),
    steps: z.array(stepSchema),
    settings: settingsSchema.default({
    stepTimeoutMs: 15000,
    runTimeoutMs: 300000,
    allowHumanHelp: true,
  }),
  })
  .superRefine((definition, ctx) => {
    const fieldKeys = new Set<string>();
    definition.fields.forEach((field, index) => {
      if (fieldKeys.has(field.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["fields", index, "key"],
          message: `Duplicate field key "${field.key}"`,
        });
      }
      fieldKeys.add(field.key);
    });

    const stepIds = new Set<string>();
    const outputKeys = new Set<string>();
    definition.steps.forEach((step, index) => {
      if (stepIds.has(step.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["steps", index, "id"],
          message: `Duplicate step id "${step.id}"`,
        });
      }
      stepIds.add(step.id);

      if (step.type === "extract") {
        if (outputKeys.has(step.outputKey)) {
          ctx.addIssue({
            code: "custom",
            path: ["steps", index, "outputKey"],
            message: `Duplicate output key "${step.outputKey}"`,
          });
        }
        outputKeys.add(step.outputKey);
      }

      if (step.type === "extractStructured") {
        if (outputKeys.has(step.root.key)) {
          ctx.addIssue({
            code: "custom",
            path: ["steps", index, "root", "key"],
            message: `Duplicate output key "${step.root.key}"`,
          });
        }
        outputKeys.add(step.root.key);
        if (step.root.kind !== "value") {
          checkExtractFieldKeys(step.root.fields, ["steps", index, "root", "fields"], ctx);
        }
      }
    });
  });

export type AutomationDefinition = z.infer<typeof automationDefinitionSchema>;
export type StepSettings = Settings;

export class DefinitionError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid automation definition:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    this.name = "DefinitionError";
    this.issues = issues;
  }
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.reduce<string>((acc, part) => {
      if (typeof part === "number") return `${acc}[${part}]`;
      return acc ? `${acc}.${String(part)}` : String(part);
    }, "");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

export function parseDefinition(input: unknown): AutomationDefinition {
  let value = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown parse error";
      throw new DefinitionError([`Invalid JSON: ${message}`]);
    }
  }

  const result = automationDefinitionSchema.safeParse(value);
  if (!result.success) {
    throw new DefinitionError(formatIssues(result.error));
  }
  return result.data;
}

export type FieldReferenceIssue = { stepId: string; message: string };

export function validateFieldReferences(definition: AutomationDefinition): FieldReferenceIssue[] {
  const fieldKeys = new Set(definition.fields.map((field) => field.key));
  const issues: FieldReferenceIssue[] = [];

  for (const step of definition.steps) {
    if (step.type === "fill" && step.value.mode === "field" && !fieldKeys.has(step.value.key)) {
      issues.push({
        stepId: step.id,
        message: `Step "${step.id}" references missing field "${step.value.key}"`,
      });
    }
    if (step.type === "upload" && !fieldKeys.has(step.fieldKey)) {
      issues.push({
        stepId: step.id,
        message: `Step "${step.id}" references missing field "${step.fieldKey}"`,
      });
    }
  }

  return issues;
}
