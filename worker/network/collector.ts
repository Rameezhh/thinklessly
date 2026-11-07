import type { BrowserContext, Response } from "playwright";
import type { NetworkEntry } from "@shared/network";
import { redactHeaders } from "@shared/network";
import type { ApiMatch } from "@shared/definition";

const MAX_ENTRIES = 300;
const MAX_BODY_BYTES = 2_000_000;
const MAX_CONCURRENT = 6;

function isJsonResponse(response: Response): boolean {
  const contentType = (response.headers()["content-type"] ?? "").toLowerCase();
  if (contentType.includes("json")) return true;
  const type = response.request().resourceType();
  return type === "fetch" || type === "xhr";
}

function safeParse(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

export function matchesApi(entry: NetworkEntry, match: ApiMatch, strict = true): boolean {
  if (entry.status >= 400) return false;
  const method = (entry.method || "GET").toUpperCase();
  if (match.method && method !== match.method.toUpperCase()) return false;
  let url: URL;
  try {
    url = new URL(entry.url);
  } catch {
    return entry.url.includes(match.pathname);
  }
  if (match.pathname && url.pathname !== match.pathname) return false;
  if (match.origin && url.origin !== match.origin) return false;
  if (!strict) return true;
  for (const [key, value] of Object.entries(match.query)) {
    if (!value) continue;
    if (url.searchParams.get(key) !== value) return false;
  }
  return true;
}

/**
 * Captures every response the Playwright page sees. Used both while recording
 * (to match a selection to its API) and while running (to read the live API
 * response without replaying a signed request).
 */
export class NetworkCollector {
  readonly entries: NetworkEntry[] = [];
  private pending = 0;
  private counter = 0;
  private disposed = false;

  constructor(private readonly context: BrowserContext) {
    context.on("response", (response) => {
      void this.record(response);
    });
    context.on("close", () => {
      this.disposed = true;
    });
  }

  private remember(entry: NetworkEntry): void {
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    }
  }

  private async record(response: Response): Promise<void> {
    if (this.disposed) return;
    const request = response.request();
    const base: NetworkEntry = {
      id: `${Date.now().toString(36)}-${this.counter++}`,
      ts: Date.now(),
      method: request.method().toUpperCase(),
      url: response.url(),
      status: response.status(),
      mime: response.headers()["content-type"] ?? "",
      resourceType: request.resourceType(),
      requestHeaders: redactHeaders(request.headers()),
      requestBody: request.postData()?.slice(0, MAX_BODY_BYTES),
    };

    if (!isJsonResponse(response) || this.pending >= MAX_CONCURRENT) {
      this.remember(base);
      return;
    }

    const length = Number(response.headers()["content-length"] ?? "0");
    if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
      this.remember({ ...base, truncated: true });
      return;
    }

    this.pending += 1;
    try {
      const buffer = await response.body();
      if (buffer.length > MAX_BODY_BYTES) {
        this.remember({ ...base, truncated: true });
        return;
      }
      const text = buffer.toString("utf8");
      const parsed = safeParse(text);
      this.remember(parsed === undefined ? { ...base, text: text.slice(0, MAX_BODY_BYTES) } : { ...base, body: parsed });
    } catch {
      this.remember(base);
    } finally {
      this.pending -= 1;
    }
  }

  findApiMatch(match: ApiMatch, sinceTs = 0, strict = false): NetworkEntry | null {
    for (let index = this.entries.length - 1; index >= 0; index -= 1) {
      const entry = this.entries[index];
      if (!entry || entry.ts < sinceTs) continue;
      if (matchesApi(entry, match, strict)) return entry;
    }
    return null;
  }

  async waitForApiMatch(match: ApiMatch, sinceTs: number, timeoutMs: number): Promise<NetworkEntry | null> {
    const startedAt = Date.now();
    const deadline = startedAt + Math.max(0, timeoutMs);
    const strictUntil = startedAt + Math.min(2500, Math.max(0, timeoutMs));
    for (;;) {
      const strict = Date.now() < strictUntil;
      const found = this.findApiMatch(match, sinceTs, strict);
      if (found) return found;
      if (Date.now() >= deadline || this.disposed) {
        return this.findApiMatch(match, sinceTs, false);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  latestTimestamp(): number {
    return this.entries[this.entries.length - 1]?.ts ?? 0;
  }
}