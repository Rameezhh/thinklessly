"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@shared/db";
import {
  DefinitionError,
  findStepById,
  parseDefinition,
  updateStepById,
  type AutomationDefinition,
  type Field,
  type Step,
} from "@shared/definition";
import {
  autoPayloadFields,
  createField,
  fieldsUsedBySteps,
  fillToCredential,
  fillToPayload,
  inferPayloadFieldType,
  removeField,
  type FillStep,
} from "@shared/fields";
import { toJson } from "@shared/json";
import { encryptSecret } from "@shared/secrets";
import { findAutomation } from "./ownership";
import { requireUser } from "./session";

export type FieldPanelState = { error?: string; success?: string };

const idSchema = z.string().min(1);

const valuesSchema = z.record(z.string(), z.string().max(50_000));

function issuesText(error: unknown): string {
  if (error instanceof DefinitionError) return error.issues.join("\n");
  return "The automation definition is invalid.";
}

type Loaded = {
  automationId: string;
  definition: AutomationDefinition;
};

async function loadCurrent(teamId: string, automationId: string): Promise<Loaded | null> {
  const automation = await findAutomation(teamId, automationId);
  if (!automation?.currentVersion) return null;
  try {
    return {
      automationId: automation.id,
      definition: parseDefinition(automation.currentVersion.definition),
    };
  } catch {
    return null;
  }
}

async function saveVersion(automationId: string, definition: AutomationDefinition): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const latest = await tx.automationVersion.aggregate({
      where: { automationId },
      _max: { versionNumber: true },
    });
    const next = (latest._max.versionNumber ?? 0) + 1;
    const version = await tx.automationVersion.create({
      data: {
        automationId,
        versionNumber: next,
        definition: toJson(definition),
      },
    });
    await tx.automation.update({
      where: { id: automationId },
      data: { currentVersionId: version.id },
    });
    return next;
  });
}

function coerceDefault(field: Field, raw: string): Field["defaultValue"] {
  if (field.type === "checkbox") return raw === "true" || raw === "on";
  if (field.type === "number") {
    if (raw.trim() === "") return undefined;
    const number = Number(raw);
    return Number.isFinite(number) ? number : raw;
  }
  return raw;
}

export async function savePayloadDefaultsAction(
  automationId: string,
  _previousState: FieldPanelState,
  formData: FormData,
): Promise<FieldPanelState> {
  void _previousState;
  const user = await requireUser();
  if (!idSchema.safeParse(automationId).success) return { error: "Invalid automation." };

  const raw = formData.get("values");
  if (typeof raw !== "string" || raw.length > 500_000) return { error: "Invalid payload values." };

  let parsedValues: unknown;
  try {
    parsedValues = JSON.parse(raw);
  } catch {
    return { error: "Invalid payload values." };
  }
  const values = valuesSchema.safeParse(parsedValues);
  if (!values.success) return { error: "Invalid payload values." };

  const loaded = await loadCurrent(user.teamId, automationId);
  if (!loaded) return { error: "Automation not found or has no published version." };

  let changed = false;
  const fields = loaded.definition.fields.map((field) => {
    if (field.secret || !(field.key in values.data)) return field;
    const next = coerceDefault(field, values.data[field.key] ?? "");
    if (JSON.stringify(next) !== JSON.stringify(field.defaultValue)) changed = true;
    return { ...field, defaultValue: next };
  });

  if (!changed) return { success: "No changes to save." };

  let updated: AutomationDefinition;
  try {
    updated = parseDefinition({ ...loaded.definition, fields });
  } catch (error) {
    return { error: issuesText(error) };
  }

  let versionNumber: number;
  try {
    versionNumber = await saveVersion(loaded.automationId, updated);
  } catch {
    return { error: "Could not save the payload defaults. Please try again." };
  }

  revalidatePath(`/dashboard/automations/${loaded.automationId}`);
  revalidatePath("/dashboard/automations");
  return { success: `Saved payload defaults as version ${versionNumber}.` };
}

export async function convertFillToPayloadAction(
  automationId: string,
  stepId: string,
): Promise<void> {
  const user = await requireUser();
  if (!idSchema.safeParse(automationId).success || !idSchema.safeParse(stepId).success) return;

  const loaded = await loadCurrent(user.teamId, automationId);
  if (!loaded) return;

  const found = findStepById(loaded.definition.steps, stepId);
  if (!found || found.type !== "fill" || found.value.mode === "field") return;
  const step = found as FillStep;

  const result = fillToPayload(loaded.definition.fields, step, {
    label: step.label,
    type: inferPayloadFieldType(step.label),
  });
  const steps = updateStepById(loaded.definition.steps, stepId, () => result.step);

  let updated: AutomationDefinition;
  try {
    updated = parseDefinition({ ...loaded.definition, fields: result.fields, steps });
  } catch {
    return;
  }

  await saveVersion(loaded.automationId, updated).catch(() => undefined);
  revalidatePath(`/dashboard/automations/${loaded.automationId}`);
  revalidatePath("/dashboard/automations");
}

export async function convertFillToCredentialAction(
  automationId: string,
  stepId: string,
): Promise<void> {
  const user = await requireUser();
  if (!idSchema.safeParse(automationId).success || !idSchema.safeParse(stepId).success) return;

  const loaded = await loadCurrent(user.teamId, automationId);
  if (!loaded) return;

  const found = findStepById(loaded.definition.steps, stepId);
  if (!found || found.type !== "fill") return;
  const step = found as FillStep;

  const result = fillToCredential(loaded.definition.fields, step, {
    label: step.label,
    type: "password",
  });
  const steps = updateStepById(loaded.definition.steps, stepId, () => result.step);

  let updated: AutomationDefinition;
  try {
    updated = parseDefinition({ ...loaded.definition, fields: result.fields, steps });
  } catch {
    return;
  }

  await saveVersion(loaded.automationId, updated).catch(() => undefined);
  revalidatePath(`/dashboard/automations/${loaded.automationId}`);
  revalidatePath("/dashboard/automations");
}

export async function moveFieldToCredentialsAction(
  automationId: string,
  fieldKey: string,
): Promise<void> {
  const user = await requireUser();
  if (!idSchema.safeParse(automationId).success || !idSchema.safeParse(fieldKey).success) return;

  const loaded = await loadCurrent(user.teamId, automationId);
  if (!loaded) return;

  const field = loaded.definition.fields.find((item) => item.key === fieldKey);
  if (!field || field.secret) return;

  const fields = loaded.definition.fields.map((item) =>
    item.key === fieldKey ? { ...item, secret: true, required: true, defaultValue: undefined } : item,
  );

  let updated: AutomationDefinition;
  try {
    updated = parseDefinition({ ...loaded.definition, fields });
  } catch {
    return;
  }

  await saveVersion(loaded.automationId, updated).catch(() => undefined);
  revalidatePath(`/dashboard/automations/${loaded.automationId}`);
  revalidatePath("/dashboard/automations");
}

export async function setStepOptionalAction(
  automationId: string,
  stepId: string,
  optional: boolean,
): Promise<void> {
  const user = await requireUser();
  if (!idSchema.safeParse(automationId).success || !idSchema.safeParse(stepId).success) return;

  const loaded = await loadCurrent(user.teamId, automationId);
  if (!loaded) return;
  if (!findStepById(loaded.definition.steps, stepId)) return;

  const steps = updateStepById(loaded.definition.steps, stepId, (step) => ({
    ...step,
    optional,
    criticality: optional ? "optional" : "required",
  }));

  let updated: AutomationDefinition;
  try {
    updated = parseDefinition({ ...loaded.definition, steps });
  } catch {
    return;
  }

  await saveVersion(loaded.automationId, updated).catch(() => undefined);
  revalidatePath(`/dashboard/automations/${loaded.automationId}`);
  revalidatePath("/dashboard/automations");
}

export async function setFieldRequiredAction(
  automationId: string,
  fieldKey: string,
  required: boolean,
): Promise<void> {
  const user = await requireUser();
  if (!idSchema.safeParse(automationId).success || !idSchema.safeParse(fieldKey).success) return;

  const loaded = await loadCurrent(user.teamId, automationId);
  if (!loaded) return;
  if (!loaded.definition.fields.some((field) => field.key === fieldKey)) return;

  const fields = loaded.definition.fields.map((field) =>
    field.key === fieldKey ? { ...field, required } : field,
  );

  let updated: AutomationDefinition;
  try {
    updated = parseDefinition({ ...loaded.definition, fields });
  } catch {
    return;
  }

  await saveVersion(loaded.automationId, updated).catch(() => undefined);
  revalidatePath(`/dashboard/automations/${loaded.automationId}`);
  revalidatePath("/dashboard/automations");
}

export async function reorderStepsAction(automationId: string, orderedIds: string[]): Promise<void> {
  const user = await requireUser();
  if (!idSchema.safeParse(automationId).success) return;
  const order = z.array(idSchema).safeParse(orderedIds);
  if (!order.success) return;

  const loaded = await loadCurrent(user.teamId, automationId);
  if (!loaded) return;

  const byId = new Map(loaded.definition.steps.map((step) => [step.id, step]));
  if (byId.size !== order.data.length || order.data.some((id) => !byId.has(id))) return;

  const steps: Step[] = [];
  for (const id of order.data) {
    const step = byId.get(id);
    if (!step) return;
    steps.push(step);
    byId.delete(id);
  }

  let updated: AutomationDefinition;
  try {
    updated = parseDefinition({ ...loaded.definition, steps });
  } catch {
    return;
  }

  await saveVersion(loaded.automationId, updated).catch(() => undefined);
  revalidatePath(`/dashboard/automations/${loaded.automationId}`);
  revalidatePath("/dashboard/automations");
}

const fieldTypeSchema = z.enum([
  "text",
  "password",
  "email",
  "number",
  "file",
  "select",
  "checkbox",
]);

const addFieldSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(80, "Label is too long"),
  key: z.string().trim().max(60).optional(),
  type: fieldTypeSchema,
  defaultValue: z.string().max(50_000).optional(),
  description: z.string().trim().max(300).optional(),
});

function addDefaultValue(type: Field["type"], raw: string | undefined): Field["defaultValue"] {
  if (raw === undefined) return undefined;
  if (type === "checkbox") return raw === "on" || raw === "true";
  if (type === "file") return undefined;
  if (type === "number") {
    if (raw.trim() === "") return undefined;
    const number = Number(raw);
    return Number.isFinite(number) ? number : undefined;
  }
  if (raw === "") return undefined;
  return raw;
}

export async function addFieldAction(
  automationId: string,
  kind: "payload" | "credential",
  _previousState: FieldPanelState,
  formData: FormData,
): Promise<FieldPanelState> {
  void _previousState;
  const user = await requireUser();
  if (!idSchema.safeParse(automationId).success) return { error: "Invalid automation." };

  const parsed = addFieldSchema.safeParse({
    label: formData.get("label"),
    key: typeof formData.get("key") === "string" ? formData.get("key") : undefined,
    type: formData.get("type"),
    defaultValue: typeof formData.get("defaultValue") === "string" ? formData.get("defaultValue") : undefined,
    description: typeof formData.get("description") === "string" ? formData.get("description") : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid field details." };
  }

  const loaded = await loadCurrent(user.teamId, automationId);
  if (!loaded) return { error: "Automation not found or has no published version." };

  const secret = kind === "credential";
  const result = createField(loaded.definition.fields, {
    label: parsed.data.label,
    key: parsed.data.key || undefined,
    type: secret ? (parsed.data.type === "file" ? "password" : parsed.data.type) : parsed.data.type,
    secret,
    required: secret ? true : formData.get("required") === "on",
    defaultValue: secret ? undefined : addDefaultValue(parsed.data.type, parsed.data.defaultValue),
    description: parsed.data.description || undefined,
  });

  let updated: AutomationDefinition;
  try {
    updated = parseDefinition({ ...loaded.definition, fields: result.fields });
  } catch (error) {
    return { error: issuesText(error) };
  }

  let versionNumber: number;
  try {
    versionNumber = await saveVersion(loaded.automationId, updated);
  } catch {
    return { error: "Could not add the field. Please try again." };
  }

  revalidatePath(`/dashboard/automations/${loaded.automationId}`);
  revalidatePath("/dashboard/automations");
  return {
    success: `${secret ? "Credential" : "Payload"} field "${result.field.key}" added as version ${versionNumber}.`,
  };
}

export async function deleteFieldAction(automationId: string, fieldKey: string): Promise<void> {
  const user = await requireUser();
  if (!idSchema.safeParse(automationId).success || !idSchema.safeParse(fieldKey).success) return;

  const loaded = await loadCurrent(user.teamId, automationId);
  if (!loaded) return;
  if (!loaded.definition.fields.some((field) => field.key === fieldKey)) return;
  if (fieldsUsedBySteps(loaded.definition.steps).includes(fieldKey)) return;

  const fields = removeField(loaded.definition.fields, fieldKey);
  let updated: AutomationDefinition;
  try {
    updated = parseDefinition({ ...loaded.definition, fields });
  } catch {
    return;
  }

  await saveVersion(loaded.automationId, updated).catch(() => undefined);
  await prisma.secret
    .deleteMany({ where: { automationId: loaded.automationId, fieldKey } })
    .catch(() => undefined);
  revalidatePath(`/dashboard/automations/${loaded.automationId}`);
  revalidatePath("/dashboard/automations");
}

export async function autoPayloadAction(automationId: string): Promise<void> {
  const user = await requireUser();
  if (!idSchema.safeParse(automationId).success) return;

  const loaded = await loadCurrent(user.teamId, automationId);
  if (!loaded) return;

  const result = autoPayloadFields(loaded.definition.fields, loaded.definition.steps);
  if (result.fields === loaded.definition.fields && result.steps === loaded.definition.steps) return;

  let updated: AutomationDefinition;
  try {
    updated = parseDefinition({ ...loaded.definition, fields: result.fields, steps: result.steps });
  } catch {
    return;
  }

  await saveVersion(loaded.automationId, updated).catch(() => undefined);
  revalidatePath(`/dashboard/automations/${loaded.automationId}`);
  revalidatePath("/dashboard/automations");
}

export async function saveCredentialsAction(
  automationId: string,
  _previousState: FieldPanelState,
  formData: FormData,
): Promise<FieldPanelState> {
  void _previousState;
  const user = await requireUser();
  if (!idSchema.safeParse(automationId).success) return { error: "Invalid automation." };

  const loaded = await loadCurrent(user.teamId, automationId);
  if (!loaded) return { error: "Automation not found or has no published version." };

  const secretFields = new Map(
    loaded.definition.fields.filter((field) => field.secret).map((field) => [field.key, field]),
  );

  const entries: { fieldKey: string; value: string }[] = [];
  for (const [name, value] of formData.entries()) {
    if (!name.startsWith("credential:") || typeof value !== "string") continue;
    const fieldKey = name.slice("credential:".length);
    if (!secretFields.has(fieldKey)) {
      return { error: `Field "${fieldKey}" is not a credential.` };
    }
    if (value.length > 50_000) return { error: `Credential "${fieldKey}" is too long.` };
    if (value.trim() !== "") entries.push({ fieldKey, value });
  }

  if (entries.length === 0) return { success: "No credential values to save." };

  try {
    for (const entry of entries) {
      const encrypted = encryptSecret(entry.value);
      await prisma.secret.upsert({
        where: {
          automationId_fieldKey: { automationId: loaded.automationId, fieldKey: entry.fieldKey },
        },
        create: {
          teamId: user.teamId,
          automationId: loaded.automationId,
          fieldKey: entry.fieldKey,
          ...encrypted,
        },
        update: { ...encrypted },
      });
    }
  } catch {
    return { error: "Could not save the credentials. Please try again." };
  }

  revalidatePath(`/dashboard/automations/${loaded.automationId}`);
  return { success: `Saved ${entries.length} credential(s).` };
}

export async function deleteCredentialAction(automationId: string, fieldKey: string): Promise<void> {
  const user = await requireUser();
  if (!idSchema.safeParse(automationId).success || !idSchema.safeParse(fieldKey).success) return;

  const loaded = await loadCurrent(user.teamId, automationId);
  if (!loaded) return;
  const field = loaded.definition.fields.find((item) => item.key === fieldKey);
  if (!field?.secret) return;

  await prisma.secret
    .deleteMany({ where: { automationId: loaded.automationId, fieldKey } })
    .catch(() => undefined);
  revalidatePath(`/dashboard/automations/${loaded.automationId}`);
}
