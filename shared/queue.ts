import { z } from "zod";
import { prisma } from "./db";
import { toJson } from "./json";

export const triggerSourceSchema = z.enum(["MANUAL", "API", "CRON", "DELAY"]);
export type TriggerSource = z.infer<typeof triggerSourceSchema>;

export const runInputsSchema = z.record(z.string(), z.unknown());
export type RunInputs = z.infer<typeof runInputsSchema>;

export const ephemeralSecretSchema = z.object({
  fieldKey: z.string().min(1),
  encryptedValue: z.string().min(1),
  iv: z.string().min(1),
  authTag: z.string().min(1),
});
export type EphemeralSecret = z.infer<typeof ephemeralSecretSchema>;

export type EnqueueRunParams = {
  automationId: string;
  inputs?: RunInputs;
  triggerSource: TriggerSource;
  scheduledAt?: Date;
  ephemeralSecrets?: EphemeralSecret[];
  idempotencyKey?: string;
};

export async function enqueueRun(params: EnqueueRunParams) {
  const automationId = z.string().min(1, "automationId is required").parse(params.automationId);
  const inputs = runInputsSchema.parse(params.inputs ?? {});
  const triggerSource = triggerSourceSchema.parse(params.triggerSource);
  const ephemeralSecrets = z
    .array(ephemeralSecretSchema)
    .default([])
    .parse(params.ephemeralSecrets ?? []);
  const idempotencyKey = z
    .string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .parse(params.idempotencyKey);

  const automation = await prisma.automation.findUnique({
    where: { id: automationId },
    include: { currentVersion: true },
  });

  if (!automation) {
    throw new Error(`Automation "${automationId}" not found`);
  }
  if (!automation.currentVersionId || !automation.currentVersion) {
    throw new Error("Automation has no published version. Publish it before running.");
  }

  return prisma.run.create({
    data: {
      automationId: automation.id,
      versionId: automation.currentVersionId,
      teamId: automation.teamId,
      status: "QUEUED",
      triggerSource,
      idempotencyKey: idempotencyKey ?? null,
      inputs: toJson(inputs),
      ephemeralSecrets: ephemeralSecrets.length > 0 ? toJson(ephemeralSecrets) : null,
      scheduledAt: params.scheduledAt ?? new Date(),
    },
  });
}
