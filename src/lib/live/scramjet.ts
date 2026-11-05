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
  const registration = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
  if (registration.active) return;
  const pending = registration.installing ?? registration.waiting;
  if (!pending) return;
  await new Promise<void>((resolve) => {
    pending.addEventListener("statechange", () => {
      if (pending.state === "activated") resolve();
    });
    if (pending.state === "activated") resolve();
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
  const connection = new window.BareMux.BareMuxConnection(BAREMUX_WORKER);
  await connection.setTransport(LIBCURL_ENTRY, [
    {
      websocket: wispUrl,
      // [total, cache, per-host]: libcurl defaults to 6 per host, which queues
      // API-heavy pages. Allow more parallel connections per host.
      connections: [100, 40, 32],
    },
  ]);
}

export function defaultWispUrl(): string {
  const configured = process.env.NEXT_PUBLIC_WISP_URL;
  if (configured) return configured;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/live/wisp/`;
}
