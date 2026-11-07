importScripts("/live/vendor/scram/scramjet.all.js");

// Take over immediately on updates and claim the live iframe as soon as the
// worker activates. Without this a new sw.js can sit in "waiting" forever and
// the browser keeps using an older proxy build.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_REQUESTS = 120;

const pendingRequests = [];
let counter = 0;

const networkChannel =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("thinklessly-network") : null;

function postToClients(message) {
  try {
    networkChannel?.postMessage(message);
  } catch {
    // Ignore channel failures.
  }
  self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clients) => {
      for (const client of clients) {
        try {
          client.postMessage(message);
        } catch {
          // The client may have closed.
        }
      }
    })
    .catch(() => undefined);
}

function headerValue(headers, name) {
  if (!headers) return "";
  const wanted = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === wanted) {
      const value = headers[key];
      return Array.isArray(value) ? value.join(", ") : String(value);
    }
  }
  return "";
}

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

function redactHeaders(headers) {
  const output = {};
  if (!headers) return output;
  for (const key of Object.keys(headers)) {
    if (SENSITIVE_HEADERS.has(key.toLowerCase())) continue;
    const value = headers[key];
    const text = Array.isArray(value) ? value.join(", ") : String(value);
    if (text.length === 0 || text.length > 2000) continue;
    output[key.toLowerCase()] = text;
  }
  return output;
}

function urlHref(value) {
  try {
    return value instanceof URL ? value.href : String(value);
  } catch {
    return "";
  }
}

async function readBytes(body) {
  if (body === null || body === undefined) return null;
  if (typeof body === "string") return new TextEncoder().encode(body);
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return new Uint8Array(await body.arrayBuffer());
  }
  if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) {
    const reader = body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return merged;
  }
  return null;
}

function matchRequest(url, method) {
  const now = Date.now();
  for (let index = pendingRequests.length - 1; index >= 0; index -= 1) {
    const candidate = pendingRequests[index];
    if (now - candidate.ts > 10_000) continue;
    if (candidate.url !== url) continue;
    if (method && candidate.method && candidate.method !== method) continue;
    pendingRequests.splice(index, 1);
    return candidate;
  }
  return null;
}

async function recordResponse(event, body) {
  try {
    const url = urlHref(event.url);
    if (!url || url.includes("/live/vendor/")) return;
    const status = Number(event.status) || 0;
    if (status >= 400) return;
    const destination = String(event.destination || "");
    if (["image", "script", "style", "font", "manifest", "audio", "video"].includes(destination)) return;
    const contentType = headerValue(event.responseHeaders, "content-type").toLowerCase();
    const couldBeJson =
      contentType.includes("json") ||
      contentType.includes("text/plain") ||
      contentType.includes("text/html") ||
      contentType === "";
    if (!couldBeJson) return;
    const bytes = await readBytes(body);
    if (!bytes || bytes.byteLength === 0 || bytes.byteLength > MAX_BODY_BYTES) return;
    const text = new TextDecoder().decode(bytes);
    const head = text.slice(0, 200).trimStart();
    const jsonLike = contentType.includes("json") || head.startsWith("{") || head.startsWith("[");
    if (!jsonLike) return;

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return;
    }

    const request = matchRequest(url, "");
    counter += 1;
    const entry = {
      id: `sw-${Date.now().toString(36)}-${counter}`,
      ts: Date.now(),
      method: (request && request.method) || "GET",
      url,
      status,
      mime: contentType,
      requestHeaders: request ? request.headers : {},
      requestBody: request && request.body ? request.body.slice(0, MAX_BODY_BYTES) : undefined,
      body: parsed,
    };
    postToClients({ __thinklessly: "network", entry });
  } catch {
    // Network capture must never break the proxied page.
  }
}

scramjet.addEventListener("request", (event) => {
  try {
    pendingRequests.push({
      url: urlHref(event.url),
      method: String(event.method || "GET").toUpperCase(),
      headers: redactHeaders(event.requestHeaders),
      body: typeof event.body === "string" ? event.body : undefined,
      ts: Date.now(),
    });
    if (pendingRequests.length > MAX_REQUESTS) pendingRequests.shift();
  } catch {
    // Ignore.
  }
});

scramjet.addEventListener("handleResponse", (event) => {
  try {
    const original = event.responseBody;
    let copy = original;
    if (typeof ReadableStream !== "undefined" && original instanceof ReadableStream) {
      const [keep, branch] = original.tee();
      event.responseBody = keep;
      copy = branch;
    }
    void recordResponse(event, copy);
  } catch {
    // Ignore.
  }
});

async function handleRequest(event) {
  await scramjet.loadConfig();
  if (scramjet.route(event)) {
    return scramjet.fetch(event);
  }
  return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});