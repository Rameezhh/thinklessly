export type ScramjetFrameLike = {
  frame: HTMLIFrameElement;
  go: (url: string) => void;
  back: () => void;
  forward: () => void;
  reload: () => void;
  addEventListener: (type: string, listener: (event: { url: string }) => void) => void;
};

type ScramjetControllerLike = {
  init: () => Promise<void>;
  createFrame: (frame?: HTMLIFrameElement) => ScramjetFrameLike;
  encodeUrl: (url: string) => string;
  decodeUrl: (url: string) => string;
};

type BareMuxConnectionLike = {
  setTransport: (entry: string, options?: unknown[]) => Promise<void>;
};

declare global {
  interface Window {
    $scramjetLoadController?: () => { ScramjetController: new (config: unknown) => ScramjetControllerLike };
    BareMux?: { BareMuxConnection: new (worker: string) => BareMuxConnectionLike };
    __thinklesslyBareMux?: BareMuxConnectionLike;
  }
}

export const SCRAM_PREFIX = "/live/proxy/";
export const SCRAM_FILES = {
  wasm: "/live/vendor/scram/scramjet.wasm.wasm",
  all: "/live/vendor/scram/scramjet.all.js",
  sync: "/live/vendor/scram/scramjet.sync.js",
};
export const BAREMUX_WORKER = "/live-worker.js";
export const LIBCURL_ENTRY = "/live-libcurl.mjs";
export const SW_URL = "/live/sw.js";
export const SW_SCOPE = "/live/";

const TRANSPORT_TIMEOUT_MS = 15_000;
const SW_PROBE = "thinklessly-sw-2";
const SW_PROBE_TIMEOUT_MS = 2_000;
const SW_ACTIVATION_TIMEOUT_MS = 10_000;
const SCRAMJET_DB = "$scramjet";
const SCRAMJET_STORES = ["config", "cookies", "redirectTrackers", "referrerPolicies", "publicSuffixList"];

function liveScope(): string {
  return new URL(SW_SCOPE, window.location.origin).href;
}

async function unregisterLiveServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const scope = liveScope();
  const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
  await Promise.all(
    registrations
      .filter((registration) => registration.scope === scope)
      .map((registration) => registration.unregister().catch(() => false)),
  );
}

function deleteScramjetDatabase(): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const request = indexedDB.deleteDatabase(SCRAMJET_DB);
    const timer = setTimeout(() => finish(false), 5_000);
    request.onsuccess = () => {
      clearTimeout(timer);
      finish(true);
    };
    request.onerror = () => {
      clearTimeout(timer);
      finish(false);
    };
  });
}

function scramjetDatabaseExists(): Promise<boolean> {
  if (typeof indexedDB.databases !== "function") return Promise.resolve(true);
  return indexedDB
    .databases()
    .then((databases) => databases.some((database) => database.name === SCRAMJET_DB))
    .catch(() => true);
}

function scramjetDatabaseValid(): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const request = indexedDB.open(SCRAMJET_DB);
    request.onupgradeneeded = () => {
      request.transaction?.abort();
      finish(true);
    };
    request.onerror = () => finish(true);
    request.onsuccess = () => {
      const db = request.result;
      const ok = SCRAMJET_STORES.every((store) => db.objectStoreNames.contains(store));
      db.close();
      finish(ok);
    };
  });
}

async function ensureScramjetDatabase(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  if (!(await scramjetDatabaseExists())) return;
  if (await scramjetDatabaseValid()) return;
  await unregisterLiveServiceWorkers();
  if (!(await deleteScramjetDatabase())) {
    throw new Error(
      "The proxy database could not be reset. Close other Thinklessly tabs, then try again.",
    );
  }
}

function probeServiceWorker(worker: ServiceWorker): Promise<string | null> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), SW_PROBE_TIMEOUT_MS);
    channel.port1.onmessage = (event: MessageEvent) => {
      clearTimeout(timer);
      const data = event.data as { probe?: unknown } | undefined;
      resolve(typeof data?.probe === "string" ? data.probe : null);
    };
    try {
      worker.postMessage({ type: "thinklessly-probe", probe: SW_PROBE }, [channel.port2]);
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

async function waitForActivation(registration: ServiceWorkerRegistration): Promise<boolean> {
  const deadline = Date.now() + SW_ACTIVATION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (registration.active?.state === "activated") return true;
    const pending = registration.installing ?? registration.waiting;
    if (pending?.state === "redundant") return false;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return registration.active?.state === "activated";
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-live-src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.liveSrc = src;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

export async function ensureLiveAssets(): Promise<void> {
  await loadScript(SCRAM_FILES.all);
  await loadScript("/live/vendor/baremux/index.js");
}

export async function registerLiveServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This browser does not support service workers.");
  }
  if (!window.isSecureContext) {
    throw new Error(
      "Live recording needs a secure browser context. Open http://localhost:3000 (not a LAN/IP address) or use the HTTPS setup: pnpm sim, then https://localhost:8443.",
    );
  }

  const scope = liveScope();
  const existing = (await navigator.serviceWorker.getRegistrations()).filter(
    (registration) => registration.scope === scope,
  );

  for (const registration of existing) {
    if (registration.active && (await probeServiceWorker(registration.active)) === SW_PROBE) {
      void registration.update().catch(() => undefined);
      return;
    }
  }

  await Promise.all(existing.map((registration) => registration.unregister().catch(() => false)));

  const registration = await navigator.serviceWorker.register(SW_URL, {
    scope: SW_SCOPE,
    updateViaCache: "none",
  });

  if (!(await waitForActivation(registration))) {
    throw new Error("The live proxy worker did not start. Reload the page and try again.");
  }
}

export async function createScramjetController(): Promise<ScramjetControllerLike> {
  await ensureScramjetDatabase();
  const loader = window.$scramjetLoadController;
  if (!loader) throw new Error("The proxy controller failed to load.");
  const { ScramjetController } = loader();
  const controller = new ScramjetController({
    prefix: SCRAM_PREFIX,
    files: SCRAM_FILES,
    flags: {
      strictRewrites: false,
      allowInvalidJs: true,
      allowFailedIntercepts: true,
      captureErrors: false,
      rewriterLogs: false,
    },
  });
  await controller.init();
  return controller;
}

export async function configureTransport(wispUrl: string): Promise<void> {
  if (!wispUrl) throw new Error("The relay URL is not configured.");
  if (!window.BareMux) throw new Error("The transport layer failed to load.");

  const options = [
    {
      websocket: wispUrl,
      // [total, cache, per-host]: libcurl defaults to 6 per host, which queues
      // API-heavy pages. Allow more parallel connections per host.
      connections: [100, 40, 32],
    },
  ];

  async function connect(): Promise<void> {
    const connection =
      window.__thinklesslyBareMux ?? new window.BareMux!.BareMuxConnection(BAREMUX_WORKER);
    window.__thinklesslyBareMux = connection;
    await withTimeout(
      connection.setTransport(LIBCURL_ENTRY, options),
      TRANSPORT_TIMEOUT_MS,
      "The proxy transport did not start. Try Reset proxy, then start recording again.",
    );
  }

  try {
    await connect();
  } catch {
    // A shared-worker port can go stale across restarts. Drop the cached
    // connection and retry once with a fresh worker path.
    window.__thinklesslyBareMux = undefined;
    try {
      localStorage.removeItem("bare-mux-path");
    } catch {
      // Storage may be unavailable in private mode.
    }
    await connect();
  }
}

export function defaultWispUrl(): string {
  const secure = window.location.protocol === "https:";
  const configured = process.env.NEXT_PUBLIC_WISP_URL;

  // A ws:// relay cannot be reached from an https:// page (mixed content), so
  // prefer the same-origin wss route used by the HTTPS proxy setup.
  if (configured && !(secure && configured.startsWith("ws://"))) return configured;

  return `${secure ? "wss" : "ws"}://${window.location.host}/live/wisp/`;
}
