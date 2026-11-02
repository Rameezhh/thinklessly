import {
  outputKeySchema,
  type AutomationDefinition,
  type ExtractField,
  type Step,
} from "./definition";

export function normalizeOutputKey(value: string, fallback = "data"): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

  if (!slug) return fallback;
  return /^[a-z]/.test(slug) ? slug : `field_${slug}`;
}

export function uniqueOutputKey(base: string, taken: Iterable<string>): string {
  const keys = new Set(taken);
  const normalized = normalizeOutputKey(base);
  if (!keys.has(normalized)) return normalized;

  let suffix = 2;
  while (keys.has(`${normalized}_${suffix}`)) suffix += 1;
  return `${normalized}_${suffix}`;
}

export function outputKeysIn(definition: AutomationDefinition): string[] {
  const keys: string[] = [];
  for (const step of definition.steps) {
    if (step.type === "extract") keys.push(step.outputKey);
    if (step.type === "extractStructured") keys.push(step.root.key);
  }
  return keys;
}

export type OutputKeyIssue = { path: string; message: string };

function checkField(field: ExtractField, path: string, issues: OutputKeyIssue[]): void {
  if (!outputKeySchema.safeParse(field.key).success) {
    issues.push({ path: `${path}.key`, message: `Invalid key "${field.key}"` });
  }
  if (field.kind === "value") {
    if (!field.selector.trim()) {
      issues.push({ path: `${path}.selector`, message: "Selector is required" });
    }
    if (!field.attribute.trim()) {
      issues.push({ path: `${path}.attribute`, message: "Attribute is required" });
    }
    return;
  }

  if (field.kind === "list" && !field.selector.trim()) {
    issues.push({ path: `${path}.selector`, message: "List selector is required" });
  }
  if (field.kind === "object" && field.selector !== undefined && !field.selector.trim()) {
    issues.push({ path: `${path}.selector`, message: "Object selector cannot be empty" });
  }

  const seen = new Set<string>();
  field.fields.forEach((child, index) => {
    if (seen.has(child.key)) {
      issues.push({
        path: `${path}.fields[${index}].key`,
        message: `Duplicate key "${child.key}"`,
      });
    }
    seen.add(child.key);
    checkField(child, `${path}.fields[${index}]`, issues);
  });
}

export function validateStructuredField(field: ExtractField): OutputKeyIssue[] {
  const issues: OutputKeyIssue[] = [];
  checkField(field, "root", issues);
  return issues;
}

export function outputIssuesForSteps(steps: Step[]): OutputKeyIssue[] {
  const issues: OutputKeyIssue[] = [];
  const outputKeys = new Set<string>();

  steps.forEach((step, index) => {
    if (step.type === "extract") {
      if (!outputKeySchema.safeParse(step.outputKey).success) {
        issues.push({ path: `steps[${index}].outputKey`, message: `Invalid key "${step.outputKey}"` });
      }
      if (outputKeys.has(step.outputKey)) {
        issues.push({ path: `steps[${index}].outputKey`, message: `Duplicate output key "${step.outputKey}"` });
      }
      outputKeys.add(step.outputKey);
    }

    if (step.type === "extractStructured") {
      if (!outputKeySchema.safeParse(step.root.key).success) {
        issues.push({ path: `steps[${index}].root.key`, message: `Invalid key "${step.root.key}"` });
      }
      if (outputKeys.has(step.root.key)) {
        issues.push({ path: `steps[${index}].root.key`, message: `Duplicate output key "${step.root.key}"` });
      }
      outputKeys.add(step.root.key);
      issues.push(
        ...validateStructuredField(step.root).map((issue) => ({
          ...issue,
          path: `steps[${index}].${issue.path}`,
        })),
      );
    }
  });

  return issues;
}
