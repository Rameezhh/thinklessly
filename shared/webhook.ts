import { createHmac } from "node:crypto";
import { prisma } from "./db";
import { fromJson, fromJsonOrThrow, toJson } from "./json";
import { decryptSecret, type EncryptedSecret } from "./secrets";

const MAX_ATTEMPTS = 3;

export async function sendRunWebhook(runId: string): Promise<void> {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: { automation: { select: { id: true, name: true } } },
  });
  if (!run) return;

  const team = await prisma.team.findUnique({
    where: { id: run.teamId },
    select: { webhookUrl: true, webhookSecretCipher: true },
  });
  if (!team?.webhookUrl || !team.webhookSecretCipher) return;

  let signingSecret: string;
  try {
    signingSecret = decryptSecret(fromJsonOrThrow<EncryptedSecret>(team.webhookSecretCipher));
  } catch {
    console.error(`[webhook] run ${run.id}: could not decrypt the signing secret`);
    return;
  }

  const body = toJson({
    event: "run.finished",
    run: {
      id: run.id,
      automationId: run.automationId,
      status: run.status,
      triggerSource: run.triggerSource,
      outputs: fromJson<Record<string, unknown>>(run.outputs ?? "{}", {}),
      error: run.error,
      createdAt: run.createdAt,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
    },
    automation: { id: run.automation.id, name: run.automation.name },
  });

  const signature = createHmac("sha256", signingSecret).update(body).digest("hex");

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(team.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Thinklessly/1.0",
          "X-Thinklessly-Event": "run.finished",
          "X-Thinklessly-Signature": `sha256=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      return;
    } catch {
      if (attempt === MAX_ATTEMPTS) {
        console.error(`[webhook] run ${run.id}: delivery failed after ${MAX_ATTEMPTS} attempts`);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
}
