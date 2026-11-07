export type NetworkEntry = {
  id: string;
  ts: number;
  method: string;
  url: string;
  status: number;
  mime: string;
  resourceType?: string;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  body?: unknown;
  text?: string;
  truncated?: boolean;
};

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "proxy-authorization",
  "x-api-key",
  "x-auth-token",
  "x-csrf-token",
  "x-xsrf-token",
]);

/** Returns a copy of headers with credentials and cookies removed. */
export function redactHeaders(
  input: Record<string, string | string[] | undefined> | undefined,
): Record<string, string> {
  const output: Record<string, string> = {};
  if (!input) return output;
  for (const [rawName, value] of Object.entries(input)) {
    const name = rawName.toLowerCase();
    if (SENSITIVE_HEADERS.has(name)) continue;
    if (value === undefined) continue;
    const text = Array.isArray(value) ? value.join(", ") : value;
    if (!text || text.length > 2000) continue;
    output[name] = text;
  }
  return output;
}

export function isJsonMime(mime: string): boolean {
  const value = mime.toLowerCase();
  return value.includes("json") || value.includes("+json") || value.includes("javascript");
}

/** Removes obvious secret values from a parsed body before it is shown in the UI. */
export function redactBody(body: unknown, secrets: string[]): unknown {
  if (secrets.length === 0) return body;
  const needles = secrets.filter((secret) => secret.length >= 4);
  if (needles.length === 0) return body;

  function scrub(value: unknown): unknown {
    if (typeof value === "string") {
      for (const needle of needles) {
        if (value.includes(needle)) return "[redacted]";
      }
      return value;
    }
    if (Array.isArray(value)) return value.map(scrub);
    if (value && typeof value === "object") {
      const output: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        output[key] = scrub(item);
      }
      return output;
    }
    return value;
  }

  return scrub(body);
}