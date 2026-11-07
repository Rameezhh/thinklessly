import { autoDismissInitScript } from "@worker/recorder/auto-dismiss";
import { buildInferScript } from "@worker/recorder/infer";
import { buildRecorderScript } from "@worker/recorder/script";
import { buildSectionsScript } from "@worker/recorder/sections";
import { buildToolbarScript } from "@worker/recorder/toolbar";

/**
 * Bridge that forwards the recorder's Playwright bindings over postMessage to
 * the parent /live page. Runs inside the proxied (same-origin) iframe before
 * the recorder scripts so their `window.__thinklessly*` calls are wired up.
 */
const BRIDGE = `(() => {
  const w = window;
  w.__thinklesslyAllowFrame = true;
  w.__thinklesslyRecord = (payload) => parent.postMessage({ __thinklessly: "record", payload }, "*");
  w.__thinklesslyCapture = (payload) => parent.postMessage({ __thinklessly: "capture", payload }, "*");
  w.__thinklesslyRemove = (id) => parent.postMessage({ __thinklessly: "remove", id }, "*");
})();`;

export function recorderBundle(captureData = true): string {
  const scripts = [BRIDGE, buildRecorderScript(), autoDismissInitScript()];
  if (captureData) scripts.push(buildInferScript(), buildSectionsScript(), buildToolbarScript());
  return scripts.join("\n");
}

/** Injects the recorder bundle into a proxied frame document. */
export function injectRecorder(doc: Document | null, captureData = true): boolean {
  if (!doc || !doc.documentElement) return false;
  const target = doc.head ?? doc.documentElement;
  const script = doc.createElement("script");
  script.setAttribute("data-thinklessly-recorder", "");
  script.textContent = recorderBundle(captureData);
  target.appendChild(script);
  script.remove();
  return true;
}
