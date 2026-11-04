import {
  updateStepById,
  valueFieldKey,
  walkSteps,
  type Field,
  type Step,
} from "./definition";

export type FillStep = Extract<Step, { type: "fill" }>;
export type SelectStep = Extract<Step, { type: "select" }>;
export type CheckStep = Extract<Step, { type: "check" }>;

export type NewFieldInput = {
  label: string;
  key?: string;
  type: Field["type"];
  secret?: boolean;
  required?: boolean;
  defaultValue?: Field["defaultValue"];
  description?: string;
};

export type CreateFieldResult = {
  fields: Field[];
  field: Field;
};

export function createField(fields: Field[], input: NewFieldInput): CreateFieldResult {
  const key = uniqueFieldKey(input.key || input.label, fields.map((field) => field.key));
  const secret = input.secret ?? false;
  const field: Field = {
    key,
    label: input.label,
    type: input.type,
    secret,
    required: secret ? true : (input.required ?? false),
    ...(secret
      ? {}
      : input.defaultValue !== undefined
        ? { defaultValue: input.defaultValue }
        : {}),
    ...(input.description ? { description: input.description } : {}),
  };

  return { fields: [...fields, field], field };
}

export function removeField(fields: Field[], key: string): Field[] {
  return fields.filter((field) => field.key !== key);
}

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

type EnsuredField = {
  fields: Field[];
  key: string;
  changed: boolean;
};

function ensurePayloadField(
  fields: Field[],
  source: string,
  label: string,
  type: Field["type"],
  defaultValue: Field["defaultValue"],
  required: boolean,
): EnsuredField {
  const suggested = normalizeFieldKey(source, "input");
  const existing = fields.find((field) => field.key === suggested && !field.secret);
  if (existing) {
    if (existing.defaultValue === undefined && defaultValue !== undefined) {
      return {
        fields: fields.map((field) =>
          field.key === existing.key ? { ...field, defaultValue, required } : field,
        ),
        key: existing.key,
        changed: true,
      };
    }
    return { fields, key: existing.key, changed: false };
  }

  const key = uniqueFieldKey(
    suggested,
    fields.map((field) => field.key),
  );
  const field: Field = {
    key,
    label: label || key,
    type,
    secret: false,
    required,
    ...(defaultValue !== undefined ? { defaultValue } : {}),
  };
  return { fields: [...fields, field], key, changed: true };
}

/**
 * Moves every recorded input step (fill, select, check, upload) into the payload
 * while keeping the recorded value as an optional default.
 */
export function autoPayloadFields(fields: Field[], steps: Step[]): AutoPayloadResult {
  let nextFields = fields;
  let nextSteps = steps;
  let fieldsChanged = false;
  let stepsChanged = false;

  walkSteps(steps, (step) => {
    if (step.type === "fill" && step.value.mode === "literal") {
      if (step.value.text.length === 0) return;
      const ensured = ensurePayloadField(
        nextFields,
        step.label ?? step.id,
        step.label ?? step.id,
        inferPayloadFieldType(step.label),
        step.value.text,
        false,
      );
      if (ensured.changed) fieldsChanged = true;
      nextFields = ensured.fields;
      nextSteps = updateStepById(nextSteps, step.id, () => ({
        ...step,
        value: { mode: "field", key: ensured.key },
      }));
      stepsChanged = true;
      return;
    }

    if (step.type === "select") {
      const key = valueFieldKey(step.value);
      if (key) return;
      const text =
        typeof step.value === "string"
          ? step.value
          : step.value.mode === "literal"
            ? step.value.text
            : "";
      const ensured = ensurePayloadField(
        nextFields,
        step.label ?? step.id,
        step.label ?? step.id,
        "select",
        text,
        false,
      );
      if (ensured.changed) fieldsChanged = true;
      nextFields = ensured.fields;
      nextSteps = updateStepById(nextSteps, step.id, () => ({
        ...step,
        value: { mode: "field", key: ensured.key },
      }));
      stepsChanged = true;
      return;
    }

    if (step.type === "check") {
      const key = valueFieldKey(step.checked);
      if (key) return;
      const checked = step.checked as boolean;
      const ensured = ensurePayloadField(
        nextFields,
        step.label ?? step.id,
        step.label ?? step.id,
        "checkbox",
        checked,
        false,
      );
      if (ensured.changed) fieldsChanged = true;
      nextFields = ensured.fields;
      nextSteps = updateStepById(nextSteps, step.id, () => ({
        ...step,
        checked: { mode: "field", key: ensured.key },
      }));
      stepsChanged = true;
      return;
    }

    if (step.type === "upload" && !nextFields.some((field) => field.key === step.fieldKey)) {
      const ensured = ensurePayloadField(
        nextFields,
        step.fieldKey,
        step.label?.replace(/^Upload\s+/i, "") || step.fieldKey,
        "file",
        undefined,
        true,
      );
      if (ensured.changed) fieldsChanged = true;
      nextFields = ensured.fields;
    }
  });

  if (!fieldsChanged && !stepsChanged) return { fields, steps };
  return { fields: nextFields, steps: nextSteps };
}

export function fieldsUsedBySteps(steps: Step[]): string[] {
  const keys = new Set<string>();
  walkSteps(steps, (step) => {
    if (step.type === "fill" && step.value.mode === "field") keys.add(step.value.key);
    if (step.type === "select") {
      const key = valueFieldKey(step.value);
      if (key) keys.add(key);
    }
    if (step.type === "check") {
      const key = valueFieldKey(step.checked);
      if (key) keys.add(key);
    }
    if (step.type === "upload") keys.add(step.fieldKey);
  });
  return [...keys];
}
