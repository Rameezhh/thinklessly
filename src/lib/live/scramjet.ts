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
export const BAREMUX_WORKER = "/live/vendor/baremux/worker.js";
export const LIBCURL_ENTRY = "/live/vendor/libcurl/index.mjs";
export const SW_URL = "/live/sw.js";
export const SW_SCOPE = "/live/";

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

  const registration = await navigator.serviceWorker.register(SW_URL, {
    scope: SW_SCOPE,
    updateViaCache: "none",
  });

  // Force a fresh check so an updated sw.js does not stay stuck in "waiting".
  await registration.update().catch(() => undefined);

  // Note: `navigator.serviceWorker.ready` is not usable here because this page
  // is `/live` while the worker scope is `/live/`. Wait on the registration
  // itself instead, with a bounded timeout so a broken worker cannot hang the UI.
  const pending = registration.installing ?? registration.waiting;
  if (!pending) return;

  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 8000);
    const settle = () => {
      if (pending.state === "activated" || pending.state === "redundant") {
        clearTimeout(timer);
        resolve();
      }
    };
    pending.addEventListener("statechange", settle);
    settle();
  });
}

export async function createScramjetController(): Promise<ScramjetControllerLike> {
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
    await connection.setTransport(LIBCURL_ENTRY, options);
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
