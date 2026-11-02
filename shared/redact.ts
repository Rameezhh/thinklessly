export function redactSecrets(message: string, secrets: Record<string, string>): string {
  let redacted = message;
  for (const value of Object.values(secrets)) {
    if (!value) continue;
    redacted = redacted.split(value).join("***");
  }
  return redacted;
}
