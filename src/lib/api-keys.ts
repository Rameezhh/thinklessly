import { createHash, randomBytes } from "node:crypto";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { key: string; prefix: string; keyHash: string } {
  const key = `wtm_${randomBytes(24).toString("base64url")}`;
  return { key, prefix: key.slice(0, 12), keyHash: hashApiKey(key) };
}
