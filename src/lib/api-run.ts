import { z } from "zod";
import { prisma } from "@shared/db";
import { DefinitionError, parseDefinition, validateFieldReferences } from "@shared/definition";
import { fromJson } from "@shared/json";
import type { EphemeralSecret } from "@shared/queue";
import { encryptSecret } from "@shared/secrets";

export const apiRunBodySchema = z
  .object({
    inputs: z
      .record(z.string(), z.union([z.string().max(50_000), z.number().finite(), z.boolean()]))
      .default({}),
    secrets: z.record(z.string(), z.string().max(50_000)).default({}),
  })
  .strict();

export type ApiRunBody = z.infer<typeof apiRunBodySchema>;

export type PrepareApiRunResult =
  | { ok: true; inputs: Record<string, unknown>; ephemeralSecrets: EphemeralSecret[] }
  | { ok: false; status: number; message: string };

export async function prepareApiRun(
  teamId: string,
  automationId: string,
  body: ApiRunBody,
): Promise<PrepareApiRunResult> {
  const automation = await prisma.automation.findFirst({
    where: { id: automationId, teamId },
    include: { currentVersion: true },
  });
  if (!automation) return { ok: false, status: 404, message: "Automation not found." };
  if (!automation.currentVersionId || !automation.currentVersion) {
    return { ok: false, status: 409, message: "Automation has no published version." };
  }

  try {
    const definition = parseDefinition(automation.currentVersion.definition);
    const referenceIssues = validateFieldReferences(definition);
    if (referenceIssues.length > 0) {
      return { ok: false, status: 400, message: referenceIssues.map((issue) => issue.message).join("; ") };
    }

    const fields = new Map(definition.fields.map((field) => [field.key, field]));
    for (const key of Object.keys(body.inputs)) {
      const field = fields.get(key);
      if (!field) return { ok: false, status: 400, message: `Unknown input "${key}".` };
      if (field.secret) {
        return { ok: false, status: 400, message: `Secret input "${key}" must be sent in "secrets".` };
      }
    }
    for (const key of Object.keys(body.secrets)) {
      const field = fields.get(key);
      if (!field) return { ok: false, status: 400, message: `Unknown secret "${key}".` };
      if (!field.secret) {
        return { ok: false, status: 400, message: `Input "${key}" is not a secret field.` };
      }
    }

    const savedSecrets = await prisma.secret.findMany({
      where: { automationId: automation.id },
      select: { fieldKey: true },
    });
    const savedKeys = new Set(savedSecrets.map((row) => row.fieldKey));

    const inputs: Record<string, unknown> = {};
    const ephemeralSecrets: EphemeralSecret[] = [];

    for (const field of definition.fields) {
      if (field.secret) {
        const supplied = body.secrets[field.key];
        if (supplied && supplied.length > 0) {
          ephemeralSecrets.push({ fieldKey: field.key, ...encryptSecret(supplied) });
        } else if (field.required && !savedKeys.has(field.key)) {
          return { ok: false, status: 400, message: `Missing required secret "${field.key}".` };
        }
        continue;
      }

      if (field.type === "file") {
        if (field.key in body.inputs || field.required) {
          return { ok: false, status: 400, message: `File input "${field.key}" is only supported from the UI.` };
        }
        continue;
      }

      const value = body.inputs[field.key];
      if (value === undefined || value === "") {
        if (field.required) return { ok: false, status: 400, message: `Missing required input "${field.key}".` };
        continue;
      }

      if (field.type === "checkbox") {
        if (typeof value !== "boolean") {
          return { ok: false, status: 400, message: `Input "${field.key}" must be a boolean.` };
        }
        inputs[field.key] = value;
        continue;
      }

      if (field.type === "number") {
        if (typeof value === "boolean" || (typeof value === "string" && value.trim() === "")) {
          return { ok: false, status: 400, message: `Input "${field.key}" must be a number.` };
        }
        const number = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(number)) {
          return { ok: false, status: 400, message: `Input "${field.key}" must be a number.` };
        }
        inputs[field.key] = number;
        continue;
      }

      if (typeof value !== "string") {
        return { ok: false, status: 400, message: `Input "${field.key}" must be a string.` };
      }
      inputs[field.key] = value;
    }

    return { ok: true, inputs, ephemeralSecrets };
  } catch (error) {
    if (error instanceof DefinitionError) {
      return { ok: false, status: 400, message: error.issues.join("; ") };
    }
    return { ok: false, status: 500, message: "Could not prepare the run." };
  }
}

type RunForApi = {
  id: string;
  automationId: string;
  status: string;
  triggerSource: string;
  outputs: string | null;
  meta: string | null;
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

const terminalStatuses = new Set(["SUCCESS", "FAILED", "CANCELLED", "NEEDS_HUMAN"]);

export function serializeRun(run: RunForApi) {
  return {
    id: run.id,
    automationId: run.automationId,
    status: run.status,
    triggerSource: run.triggerSource,
    outputs: fromJson<Record<string, unknown>>(run.outputs ?? "{}", {}),
    meta: fromJson<Record<string, unknown>>(run.meta ?? "{}", {}),
    error: run.error,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
  };
}

export async function findApiRun(teamId: string, runId: string) {
  return prisma.run.findFirst({
    where: { id: runId, teamId },
    select: {
      id: true,
      automationId: true,
      status: true,
      triggerSource: true,
      outputs: true,
      meta: true,
      error: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
    },
  });
}

export async function waitForRun(teamId: string, runId: string, waitSeconds: number) {
  const deadline = Date.now() + waitSeconds * 1000;
  let run = await findApiRun(teamId, runId);

  while (run && !terminalStatuses.has(run.status) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    run = await findApiRun(teamId, runId);
  }

  return run;
}
