import { prisma } from "@shared/db";
import { hashApiKey } from "./api-keys";

export type ApiAuth = { apiKeyId: string; teamId: string };

export async function authenticateApiKey(request: Request): Promise<ApiAuth | null> {
  const authorization = request.headers.get("authorization");
  const apiKeyHeader = request.headers.get("x-api-key");
  const key = authorization?.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : apiKeyHeader?.trim();

  if (!key || !key.startsWith("wtm_") || key.length > 200) return null;

  const row = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(key) },
    select: { id: true, teamId: true, revokedAt: true },
  });
  if (!row || row.revokedAt) return null;

  await prisma.apiKey
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return { apiKeyId: row.id, teamId: row.teamId };
}
