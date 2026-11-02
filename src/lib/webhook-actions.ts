"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@shared/db";
import { toJson } from "@shared/json";
import { encryptSecret } from "@shared/secrets";
import { requireUser } from "./session";

export type WebhookFormState = { error?: string; saved?: boolean; secret?: string };

const urlSchema = z.object({
  webhookUrl: z.string().trim().max(2000, "Webhook URL is too long"),
});

function isValidWebhookUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function newSigningSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

export async function saveWebhookAction(
  _previousState: WebhookFormState,
  formData: FormData,
): Promise<WebhookFormState> {
  void _previousState;
  const user = await requireUser();
  const parsed = urlSchema.safeParse({ webhookUrl: formData.get("webhookUrl") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid webhook URL." };
  }

  const url = parsed.data.webhookUrl;
  if (url && !isValidWebhookUrl(url)) {
    return { error: "Webhook URL must use http:// or https://." };
  }

  const team = await prisma.team.findUnique({
    where: { id: user.teamId },
    select: { webhookSecretCipher: true },
  });
  if (!team) return { error: "Team not found." };

  let secret: string | undefined;
  try {
    if (url && !team.webhookSecretCipher) {
      secret = newSigningSecret();
      await prisma.team.update({
        where: { id: user.teamId },
        data: { webhookUrl: url, webhookSecretCipher: toJson(encryptSecret(secret)) },
      });
    } else {
      await prisma.team.update({
        where: { id: user.teamId },
        data: { webhookUrl: url || null },
      });
    }
  } catch {
    return { error: "Could not save the webhook settings." };
  }

  revalidatePath("/dashboard/api");
  return { saved: true, secret };
}

export async function rotateWebhookSecretAction(): Promise<WebhookFormState> {
  const user = await requireUser();
  const secret = newSigningSecret();

  try {
    await prisma.team.update({
      where: { id: user.teamId },
      data: { webhookSecretCipher: toJson(encryptSecret(secret)) },
    });
  } catch {
    return { error: "Could not rotate the signing secret." };
  }

  revalidatePath("/dashboard/api");
  return { saved: true, secret };
}
