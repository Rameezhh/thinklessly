"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@shared/db";
import { parseDefinition } from "@shared/definition";
import { toJson } from "@shared/json";
import { runInputsSchema } from "@shared/queue";
import { computeNextCronRun, cronExpressionSchema, timezoneSchema } from "@shared/triggers";
import { findAutomation } from "./ownership";
import { requireUser } from "./session";

export type TriggerFormState = { error?: string; ok?: boolean };

const inputsSchema = z.string().trim().max(50_000).default("{}");

const cronFormSchema = z.object({
  cronExpression: cronExpressionSchema,
  timezone: timezoneSchema,
  inputsJson: inputsSchema,
});

const delayFormSchema = z.object({
  delaySeconds: z.coerce
    .number()
    .int("Delay must be a whole number of seconds")
    .min(5, "Delay must be at least 5 seconds")
    .max(604800, "Delay cannot exceed 7 days"),
  inputsJson: inputsSchema,
});

function parseInputs(raw: string): { ok: true; inputs: Record<string, unknown> } | { ok: false; error: string } {
  let value: unknown;
  try {
    value = raw.trim() === "" ? {} : JSON.parse(raw);
  } catch {
    return { ok: false, error: "Inputs must be valid JSON." };
  }
  const parsed = runInputsSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: "Inputs must be a JSON object." };
  return { ok: true, inputs: parsed.data };
}

type AutomationForTrigger = NonNullable<Awaited<ReturnType<typeof findAutomation>>>;

function validateTriggerInputs(
  automation: AutomationForTrigger,
  inputs: Record<string, unknown>,
): string | null {
  if (!automation.currentVersion) return "Publish a version before adding triggers.";

  let definition;
  try {
    definition = parseDefinition(automation.currentVersion.definition);
  } catch {
    return "The stored automation definition is invalid.";
  }

  const fields = new Map(definition.fields.map((field) => [field.key, field]));
  for (const key of Object.keys(inputs)) {
    const field = fields.get(key);
    if (!field) return `Unknown trigger input "${key}".`;
    if (field.secret) return `Input "${key}" is secret. Save it on a manual run instead.`;
    if (field.type === "file") return `File input "${key}" is not supported in triggers.`;
  }

  for (const field of definition.fields) {
    if (field.secret || field.type === "file") continue;
    if (field.required && field.defaultValue === undefined && inputs[field.key] === undefined) {
      return `Missing required input "${field.key}".`;
    }
  }

  return null;
}

export async function createCronTriggerAction(
  automationId: string,
  _previousState: TriggerFormState,
  formData: FormData,
): Promise<TriggerFormState> {
  void _previousState;
  const user = await requireUser();
  const automation = await findAutomation(user.teamId, automationId);
  if (!automation) return { error: "Automation not found." };

  const parsed = cronFormSchema.safeParse({
    cronExpression: formData.get("cronExpression"),
    timezone: formData.get("timezone"),
    inputsJson: formData.get("inputsJson") ?? "{}",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid trigger." };

  const inputs = parseInputs(parsed.data.inputsJson);
  if (!inputs.ok) return { error: inputs.error };
  const inputsIssue = validateTriggerInputs(automation, inputs.inputs);
  if (inputsIssue) return { error: inputsIssue };

  let nextRunAt: Date | null;
  try {
    nextRunAt = computeNextCronRun(parsed.data.cronExpression, parsed.data.timezone);
  } catch {
    return { error: "Invalid cron expression or timezone." };
  }
  if (!nextRunAt) return { error: "This cron expression has no future run." };

  try {
    await prisma.trigger.create({
      data: {
        automationId,
        type: "CRON",
        cronExpression: parsed.data.cronExpression,
        timezone: parsed.data.timezone,
        inputs: toJson(inputs.inputs),
        enabled: true,
        nextRunAt,
      },
    });
  } catch {
    return { error: "Could not save the trigger." };
  }

  revalidatePath(`/dashboard/automations/${automationId}`);
  return { ok: true };
}

export async function createDelayTriggerAction(
  automationId: string,
  _previousState: TriggerFormState,
  formData: FormData,
): Promise<TriggerFormState> {
  void _previousState;
  const user = await requireUser();
  const automation = await findAutomation(user.teamId, automationId);
  if (!automation) return { error: "Automation not found." };

  const parsed = delayFormSchema.safeParse({
    delaySeconds: formData.get("delaySeconds"),
    inputsJson: formData.get("inputsJson") ?? "{}",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid delay." };

  const inputs = parseInputs(parsed.data.inputsJson);
  if (!inputs.ok) return { error: inputs.error };
  const inputsIssue = validateTriggerInputs(automation, inputs.inputs);
  if (inputsIssue) return { error: inputsIssue };

  try {
    await prisma.trigger.create({
      data: {
        automationId,
        type: "DELAY",
        delaySeconds: parsed.data.delaySeconds,
        inputs: toJson(inputs.inputs),
        enabled: true,
        nextRunAt: new Date(Date.now() + parsed.data.delaySeconds * 1000),
      },
    });
  } catch {
    return { error: "Could not save the trigger." };
  }

  revalidatePath(`/dashboard/automations/${automationId}`);
  return { ok: true };
}

async function findTrigger(teamId: string, triggerId: string) {
  return prisma.trigger.findFirst({
    where: { id: triggerId, automation: { teamId } },
    include: { automation: { select: { id: true } } },
  });
}

export async function toggleTriggerAction(triggerId: string): Promise<void> {
  const user = await requireUser();
  const parsed = z.string().min(1).safeParse(triggerId);
  if (!parsed.success) return;

  const trigger = await findTrigger(user.teamId, parsed.data);
  if (!trigger) return;

  if (trigger.enabled) {
    await prisma.trigger.update({ where: { id: trigger.id }, data: { enabled: false, nextRunAt: null } });
  } else {
    let nextRunAt: Date | null = null;
    if (trigger.type === "CRON" && trigger.cronExpression) {
      try {
        nextRunAt = computeNextCronRun(trigger.cronExpression, trigger.timezone ?? "UTC");
      } catch {
        nextRunAt = null;
      }
    } else if (trigger.type === "DELAY") {
      nextRunAt = new Date(Date.now() + (trigger.delaySeconds ?? 60) * 1000);
    }
    if (!nextRunAt) return;
    await prisma.trigger.update({ where: { id: trigger.id }, data: { enabled: true, nextRunAt } });
  }

  revalidatePath(`/dashboard/automations/${trigger.automation.id}`);
}

export async function deleteTriggerAction(triggerId: string): Promise<void> {
  const user = await requireUser();
  const parsed = z.string().min(1).safeParse(triggerId);
  if (!parsed.success) return;

  const trigger = await findTrigger(user.teamId, parsed.data);
  if (!trigger) return;

  await prisma.trigger.delete({ where: { id: trigger.id } });
  revalidatePath(`/dashboard/automations/${trigger.automation.id}`);
}
