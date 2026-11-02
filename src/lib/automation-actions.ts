"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@shared/db";
import {
  DefinitionError,
  parseDefinition,
  validateFieldReferences,
  type AutomationDefinition,
} from "@shared/definition";
import { toJson } from "@shared/json";
import { enqueueRun, type EphemeralSecret } from "@shared/queue";
import { encryptSecret } from "@shared/secrets";
import { findAutomation } from "./ownership";
import { requireUser } from "./session";
import { MAX_UPLOAD_BYTES, saveUploadedFile, UploadError } from "./upload";

const importSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
  definitionJson: z
    .string()
    .min(2, "Paste a definition JSON document")
    .max(500_000, "Definition JSON is too large"),
});

export type ImportAutomationState = { error?: string };
export type RunFormState = { error?: string };

function definitionIssues(error: unknown): string {
  if (error instanceof DefinitionError) return error.issues.join("\n");
  return "The automation definition is invalid.";
}

export async function importAutomationAction(
  _previousState: ImportAutomationState,
  formData: FormData,
): Promise<ImportAutomationState> {
  const user = await requireUser();
  const parsed = importSchema.safeParse({
    name: formData.get("name"),
    definitionJson: formData.get("definitionJson"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid import details." };
  }

  let definition: AutomationDefinition;
  try {
    definition = parseDefinition(parsed.data.definitionJson);
    const referenceIssues = validateFieldReferences(definition);
    if (referenceIssues.length > 0) {
      throw new DefinitionError(referenceIssues.map((issue) => issue.message));
    }
  } catch (error) {
    return { error: definitionIssues(error) };
  }

  let automationId: string;
  try {
    const automation = await prisma.$transaction(async (tx) => {
      const created = await tx.automation.create({
        data: {
          teamId: user.teamId,
          name: parsed.data.name,
          description: definition.startUrl,
          status: "ACTIVE",
        },
      });
      const version = await tx.automationVersion.create({
        data: {
          automationId: created.id,
          versionNumber: 1,
          definition: toJson(definition),
        },
      });
      return tx.automation.update({
        where: { id: created.id },
        data: { currentVersionId: version.id },
      });
    });
    automationId = automation.id;
  } catch {
    return { error: "Could not save the automation. Please try again." };
  }

  revalidatePath("/dashboard/automations");
  redirect(`/dashboard/automations/${automationId}`);
}

function rawValue(formData: FormData, key: string): FormDataEntryValue | null {
  return formData.get(`field:${key}`);
}

export async function startRunAction(
  automationId: string,
  _previousState: RunFormState,
  formData: FormData,
): Promise<RunFormState> {
  const user = await requireUser();
  const parsedId = z.string().min(1).safeParse(automationId);
  if (!parsedId.success) return { error: "Invalid automation." };

  const automation = await findAutomation(user.teamId, parsedId.data);
  if (!automation) return { error: "Automation not found." };
  if (!automation.currentVersionId || !automation.currentVersion) {
    return { error: "This automation has no published version yet." };
  }

  let definition: AutomationDefinition;
  try {
    definition = parseDefinition(automation.currentVersion.definition);
    const referenceIssues = validateFieldReferences(definition);
    if (referenceIssues.length > 0) {
      throw new DefinitionError(referenceIssues.map((issue) => issue.message));
    }
  } catch (error) {
    return { error: definitionIssues(error) };
  }

  const savedSecrets = await prisma.secret.findMany({
    where: { automationId: automation.id },
    select: { fieldKey: true },
  });
  const savedSecretKeys = new Set(savedSecrets.map((row) => row.fieldKey));

  const inputs: Record<string, unknown> = {};
  const ephemeralSecrets: EphemeralSecret[] = [];
  const rememberSecrets = z.boolean().parse(formData.get("rememberSecrets") === "on");

  for (const field of definition.fields) {
    const raw = rawValue(formData, field.key);

    if (field.type === "file") {
      const file = raw instanceof File && raw.size > 0 ? raw : null;
      if (!file) {
        if (field.required) return { error: `${field.label} is required.` };
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) return { error: `${field.label} is larger than 25 MB.` };
      try {
        inputs[field.key] = await saveUploadedFile(file);
      } catch (error) {
        return {
          error: error instanceof UploadError ? error.message : `Could not upload ${field.label}.`,
        };
      }
      continue;
    }

    if (field.type === "checkbox") {
      inputs[field.key] = z.boolean().parse(raw === "on");
      continue;
    }

    const valueResult = z.string().max(50_000, `${field.label} is too long`).safeParse(raw ?? "");
    if (!valueResult.success) {
      return { error: valueResult.error.issues[0]?.message ?? `${field.label} is invalid.` };
    }
    const value = valueResult.data;

    if (field.secret) {
      if (value.length === 0) {
        if (field.required && !savedSecretKeys.has(field.key)) {
          return { error: `${field.label} is required.` };
        }
        continue;
      }

      const encrypted = encryptSecret(value);
      if (rememberSecrets) {
        try {
          await prisma.secret.upsert({
            where: { automationId_fieldKey: { automationId: automation.id, fieldKey: field.key } },
            create: {
              teamId: user.teamId,
              automationId: automation.id,
              fieldKey: field.key,
              ...encrypted,
            },
            update: { ...encrypted },
          });
        } catch {
          return { error: `Could not save ${field.label}.` };
        }
      } else {
        ephemeralSecrets.push({ fieldKey: field.key, ...encrypted });
      }
      continue;
    }

    if (value.length === 0) {
      if (field.required) return { error: `${field.label} is required.` };
      continue;
    }

    if (field.type === "number") {
      const number = z.coerce.number().finite().safeParse(value);
      if (!number.success) return { error: `${field.label} must be a number.` };
      inputs[field.key] = number.data;
      continue;
    }

    inputs[field.key] = value;
  }

  let runId: string;
  try {
    const run = await enqueueRun({
      automationId: automation.id,
      inputs,
      triggerSource: "MANUAL",
      ephemeralSecrets,
    });
    runId = run.id;
  } catch {
    return { error: "Could not queue the run. Please try again." };
  }

  revalidatePath("/dashboard/automations");
  redirect(`/dashboard/runs/${runId}`);
}
