"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@shared/db";
import { generateApiKey } from "./api-keys";
import { requireUser } from "./session";

export type ApiKeyFormState = { error?: string; key?: string };

const createSchema = z.object({
  name: z.string().trim().min(1, "Key name is required").max(80, "Key name is too long"),
});

export async function createApiKeyAction(
  _previousState: ApiKeyFormState,
  formData: FormData,
): Promise<ApiKeyFormState> {
  const user = await requireUser();
  const parsed = createSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid key name." };
  }

  const { key, prefix, keyHash } = generateApiKey();
  try {
    await prisma.apiKey.create({
      data: { teamId: user.teamId, name: parsed.data.name, prefix, keyHash },
    });
  } catch {
    return { error: "Could not create the API key. Please try again." };
  }

  revalidatePath("/dashboard/api");
  return { key };
}

export async function revokeApiKeyAction(apiKeyId: string): Promise<void> {
  const user = await requireUser();
  const parsed = z.string().min(1).safeParse(apiKeyId);
  if (!parsed.success) return;

  await prisma.apiKey.updateMany({
    where: { id: parsed.data, teamId: user.teamId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  revalidatePath("/dashboard/api");
}
