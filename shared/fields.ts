import { updateStepById, walkSteps, type Field, type Step } from "./definition";

export type FillStep = Extract<Step, { type: "fill" }>;

export type FieldChange = {
  fields: Field[];
  step: FillStep;
};

export function normalizeFieldKey(value: string, fallback = "input"): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

  if (!slug) return fallback;
  return /^[a-z]/.test(slug) ? slug : `field_${slug}`;
}

export function uniqueFieldKey(base: string, taken: Iterable<string>): string {
  const keys = new Set(taken);
  const normalized = normalizeFieldKey(base);
  if (!keys.has(normalized)) return normalized;

  let suffix = 2;
  while (keys.has(`${normalized}_${suffix}`)) suffix += 1;
  return `${normalized}_${suffix}`;
}

export function markFieldSecret(fields: Field[], key: string): Field[] {
  return fields.map((field) =>
    field.key === key ? { ...field, secret: true, required: true, defaultValue: undefined } : field,
  );
}

export function setFieldDefault(fields: Field[], key: string, value: Field["defaultValue"]): Field[] {
  return fields.map((field) => (field.key === key ? { ...field, defaultValue: value } : field));
}

export type ConvertOptions = {
  key?: string;
  label?: string;
  type?: Field["type"];
};

export function inferPayloadFieldType(label: string | undefined): Field["type"] {
  const value = (label ?? "").toLowerCase();
  if (value.includes("email")) return "email";
  if (value.includes("number") || value.includes("amount") || value.includes("quantity")) return "number";
  return "text";
}

export function fillToPayload(fields: Field[], step: FillStep, options: ConvertOptions = {}): FieldChange {
  if (step.value.mode === "field") {
    return { fields, step };
  }

  const key = uniqueFieldKey(
    options.key ?? step.label ?? step.id,
    fields.map((field) => field.key),
  );
  const field: Field = {
    key,
    label: options.label ?? step.label ?? key,
    type: options.type ?? "text",
    secret: false,
    required: false,
    defaultValue: step.value.text,
  };

  return {
    fields: [...fields, field],
    step: { ...step, value: { mode: "field", key } },
  };
}

export function fillToCredential(
  fields: Field[],
  step: FillStep,
  options: ConvertOptions = {},
): FieldChange & { fieldKey: string } {
  if (step.value.mode === "field") {
    return {
      fields: markFieldSecret(fields, step.value.key),
      step,
      fieldKey: step.value.key,
    };
  }

  const key = uniqueFieldKey(
    options.key ?? step.label ?? step.id,
    fields.map((field) => field.key),
  );
  const field: Field = {
    key,
    label: options.label ?? step.label ?? key,
    type: options.type ?? "password",
    secret: true,
    required: true,
  };

  return {
    fields: [...fields, field],
    step: { ...step, value: { mode: "field", key } },
    fieldKey: key,
  };
}

export type AutoPayloadResult = {
  fields: Field[];
  steps: Step[];
};

export function autoPayloadFields(fields: Field[], steps: Step[]): AutoPayloadResult {
  let nextFields = fields;
  let nextSteps = steps;
  let fieldsChanged = false;
  let stepsChanged = false;

  walkSteps(steps, (step) => {
    if (step.type === "fill" && step.value.mode === "literal") {
      const suggested = normalizeFieldKey(step.label ?? step.id, "input");
      const existing = nextFields.find((field) => field.key === suggested);
      if (existing) {
        if (!existing.secret && existing.defaultValue === undefined) {
          nextFields = setFieldDefault(nextFields, existing.key, step.value.text).map((field) =>
            field.key === existing.key ? { ...field, required: false } : field,
          );
          fieldsChanged = true;
        }
        nextSteps = updateStepById(nextSteps, step.id, () => ({
          ...step,
          value: { mode: "field", key: existing.key },
        }));
        stepsChanged = true;
        return;
      }

      const result = fillToPayload(nextFields, step, {
        label: step.label,
        type: inferPayloadFieldType(step.label),
      });
      if (result.fields !== nextFields) {
        nextFields = result.fields;
        fieldsChanged = true;
      }
      if (result.step !== step) {
        nextSteps = updateStepById(nextSteps, step.id, () => result.step);
        stepsChanged = true;
      }
      return;
    }

    if (step.type === "upload" && !nextFields.some((field) => field.key === step.fieldKey)) {
      nextFields = [
        ...nextFields,
        {
          key: step.fieldKey,
          label: step.label?.replace(/^Upload\s+/i, "") || step.fieldKey,
          type: "file",
          secret: false,
          required: true,
        },
      ];
      fieldsChanged = true;
    }
  });

  if (!fieldsChanged && !stepsChanged) return { fields, steps };
  return { fields: nextFields, steps: nextSteps };
}

export function fieldsUsedBySteps(steps: Step[]): string[] {
  const keys = new Set<string>();
  walkSteps(steps, (step) => {
    if (step.type === "fill" && step.value.mode === "field") keys.add(step.value.key);
    if (step.type === "upload") keys.add(step.fieldKey);
  });
  return [...keys];
}
