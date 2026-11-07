"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Step } from "@shared/definition";
import { autoPayloadFields } from "@shared/fields";
import { outputIssuesForSteps } from "@shared/outputs";
import { RecorderReview } from "@/components/automations/recorder-review";
import { LiveSaveForm } from "@/components/live/live-save";
import { detectProxyFailure, type ProxyFailure } from "@/lib/live/failure";
import { injectRecorder } from "@/lib/live/inject";
import {
  configureTransport,
  createScramjetController,
  defaultWispUrl,
  ensureLiveAssets,
  registerLiveServiceWorker,
  type ScramjetFrameLike,
} from "@/lib/live/scramjet";
import { LiveRecorderSession, type LiveSnapshot } from "@/lib/live/session";

type Phase = "setup" | "launched" | "starting" | "recording" | "stopped";

const NAVIGATION_TIMEOUT_MS = 20_000;

const inputClass = "field";

const emptySnapshot: LiveSnapshot = { fields: [], steps: [], previews: {}, previewTotals: {} };

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

type Props = {
  initialUrl: string;
  initialName?: string;
  autostart?: boolean;
  fullscreen?: boolean;
};

export function LiveRecorder({ initialUrl, initialName = "", autostart = false, fullscreen = false }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("setup");
  const [name, setName] = useState(initialName);
  const [url, setUrl] = useState(initialUrl);
  const [captureData, setCaptureData] = useState(true);
  const [startedUrl, setStartedUrl] = useState(initialUrl);
  const [snapshot, setSnapshot] = useState<LiveSnapshot>(emptySnapshot);
  const [error, setError] = useState<string | null>(() =>
    fullscreen && autostart && !initialUrl ? "No starting URL was provided." : null,
  );
  const [failure, setFailure] = useState<ProxyFailure | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<ScramjetFrameLike | null>(null);
  const sessionRef = useRef<LiveRecorderSession | null>(null);
  const captureDataRef = useRef(captureData);
  const autoStartedRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    captureDataRef.current = captureData;
  }, [captureData]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { __thinklessly?: string } | undefined;
      if (!data || typeof data.__thinklessly !== "string") return;
      sessionRef.current?.handleMessage(data);
    }
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    function onServiceWorkerMessage(event: MessageEvent) {
      const data = event.data as { __thinklessly?: string; entry?: unknown } | undefined;
      if (data?.__thinklessly === "network") sessionRef.current?.addNetworkEntry(data.entry);
    }
    navigator.serviceWorker.addEventListener("message", onServiceWorkerMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onServiceWorkerMessage);
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("thinklessly-network");
    channel.onmessage = (event: MessageEvent) => {
      const data = event.data as { __thinklessly?: string; entry?: unknown } | undefined;
      if (data?.__thinklessly === "network") sessionRef.current?.addNetworkEntry(data.entry);
    };
    return () => channel.close();
  }, []);

  function injectCurrentFrame() {
    const frame = frameRef.current;
    if (!frame) return;
    try {
      injectRecorder(frame.frame.contentDocument, captureDataRef.current);
    } catch {
      // The frame may still be navigating; the load handler retries.
    }
  }

  function clearWatchdog() {
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = undefined;
  }

  function startWatchdog() {
    clearWatchdog();
    watchdogRef.current = setTimeout(() => {
      const doc = frameRef.current?.frame.contentDocument ?? null;
      const detected = detectProxyFailure(doc);
      if (detected) {
        setFailure(detected);
        return;
      }
      if (doc && doc.readyState === "loading" && !doc.body) {
        setFailure({
          kind: "timeout",
          title: "This page is taking too long",
          message:
            "The page has not finished loading. It may be blocked, require a bot check, or depend on a resource the proxy cannot fetch.",
        });
      }
    }, NAVIGATION_TIMEOUT_MS);
  }

  function checkFailure() {
    const doc = frameRef.current?.frame.contentDocument ?? null;
    setFailure(detectProxyFailure(doc));
  }

  function onFrameLoad() {
    window.setTimeout(() => {
      injectCurrentFrame();
      clearWatchdog();
      checkFailure();
    }, 60);
  }

  function onNavigation() {
    startWatchdog();
    window.setTimeout(checkFailure, 1200);
  }

  async function startRecording() {
    setError(null);
    setFailure(null);
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      setError("Enter a valid starting URL.");
      setPhase("setup");
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      setError("The starting URL must use http:// or https://.");
      setPhase("setup");
      return;
    }

    setPhase("starting");
    setStartedUrl(parsed.toString());

    try {
      await ensureLiveAssets();
      const controller = await createScramjetController();
      await registerLiveServiceWorker();
      await configureTransport(defaultWispUrl());
      const frame = controller.createFrame();
      frame.frame.className = "h-full w-full border-0 bg-white";
      frame.frame.title = "Live site";
      containerRef.current?.replaceChildren(frame.frame);
      frameRef.current = frame;
      frame.frame.addEventListener("load", onFrameLoad);

      const session = new LiveRecorderSession(
        () => frameRef.current?.frame.contentDocument ?? null,
        (value: string) => {
          try {
            return controller.decodeUrl(value);
          } catch {
            return value;
          }
        },
      );
      sessionRef.current = session;
      session.subscribe((next) => setSnapshot(next));
      session.onError((issue) => setError(issue.message));

      frame.addEventListener("urlchange", (event) => {
        session.scheduleNavigation(event.url);
        onNavigation();
      });
      session.begin(parsed.toString());

      frame.go(parsed.toString());
      setPhase("recording");
      startWatchdog();
      window.setTimeout(onFrameLoad, 600);
    } catch (startError) {
      setPhase("setup");
      setError(errorText(startError));
    }
  }

  useEffect(() => {
    if (!fullscreen || !autostart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    if (!initialUrl) return;
    window.setTimeout(() => void startRecording(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen, autostart]);

  function launchNewTab() {
    setError(null);
    if (!name.trim()) {
      setError("Enter a name for the automation.");
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      setError("Enter a valid starting URL.");
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      setError("The starting URL must use http:// or https://.");
      return;
    }

    const target = `/live?url=${encodeURIComponent(parsed.toString())}&name=${encodeURIComponent(
      name.trim(),
    )}&autostart=1&fullscreen=1`;
    const win = window.open(target, "_blank");
    if (!win) {
      router.push(target);
      return;
    }
    setStartedUrl(parsed.toString());
    setPhase("launched");
  }

  function retryFrame() {
    setFailure(null);
    clearWatchdog();
    frameRef.current?.reload();
    startWatchdog();
  }

  async function endRecording() {
    const session = sessionRef.current;
    if (!session) return;
    const frameWindow = frameRef.current?.frame.contentWindow as
      | (Window & { __thinklesslyFlush?: () => void })
      | null;
    try {
      frameWindow?.__thinklesslyFlush?.();
    } catch {
      // The iframe may already be navigating.
    }
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    session.stop();
    const normalized = autoPayloadFields(session.core.fields, session.core.steps);
    session.core.fields = normalized.fields;
    session.core.steps = normalized.steps;
    setSnapshot(session.snapshot());
    setError(null);
    setFailure(null);
    setPhase("stopped");
  }

  function cancelRecording() {
    sessionRef.current?.stop();
    clearWatchdog();
    const frame = frameRef.current;
    frame?.frame.removeEventListener("load", onFrameLoad);
    frameRef.current = null;
    sessionRef.current = null;
    containerRef.current?.replaceChildren();
    setSnapshot({ ...emptySnapshot });
    setError(null);
    setFailure(null);
    setPhase("setup");
  }

  function exitSession() {
    if (!fullscreen) {
      cancelRecording();
      return;
    }
    window.close();
    window.setTimeout(() => router.push("/dashboard/automations/create"), 150);
  }

  const outputIssues = useMemo(() => outputIssuesForSteps(snapshot.steps), [snapshot.steps]);
  const definitionJson = useMemo(() => {
    if (snapshot.steps.length === 0) return "";
    return JSON.stringify({
      version: 1,
      startUrl: startedUrl,
      fields: snapshot.fields,
      steps: snapshot.steps,
      settings: { stepTimeoutMs: 15000, runTimeoutMs: 300000, allowHumanHelp: true },
    });
  }, [snapshot, startedUrl]);

  if (fullscreen) {
    return (
      <div className="fixed inset-0 bg-white">
        <div ref={containerRef} className="h-full w-full" />

        {phase === "starting" ? (
          <div className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-[#F7F7F4] text-sm text-[#5C6070]">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-[#0E0F13] border-t-transparent" />
            Loading the live site...
          </div>
        ) : null}

        {error ? (
          <div className="animate-fade fixed left-1/2 top-3 z-40 max-w-[min(90vw,32rem)] -translate-x-1/2 rounded-xl bg-[#B42318] px-4 py-2.5 text-sm text-white shadow-lg">
            {error}
          </div>
        ) : null}

        {phase === "recording" && !failure ? (
          <div className="animate-rise fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-2xl bg-[#0E0F13] p-2 shadow-[0_18px_50px_rgba(14,15,19,0.4)]">
            <span className="flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-white">
              <span className="animate-pulse-dot h-2.5 w-2.5 rounded-full bg-[#FF5A4D]" />
              Recording
            </span>
            <button
              type="button"
              onClick={endRecording}
              className="rounded-[10px] bg-[#C8F23B] px-3.5 py-2 text-[13px] font-semibold text-[#0E0F13] transition-transform hover:-translate-y-0.5"
            >
              End automation
            </button>
            <button
              type="button"
              onClick={exitSession}
              className="rounded-[10px] px-3 py-2 text-[13px] font-medium text-[#C9CCD6] transition-colors hover:bg-white/5 hover:text-white"
            >
              Cancel
            </button>
          </div>
        ) : null}

        {failure ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]">
            <div className="animate-rise w-full max-w-md rounded-3xl border border-[#E5E4DE] bg-white p-6 shadow-2xl">
              <h2 className="display text-[24px] tracking-[-0.02em]">{failure.title}</h2>
              <p className="mt-2.5 text-sm leading-relaxed text-[#5C6070]">{failure.message}</p>
              <p className="mt-4 rounded-xl border border-[#CFE58A] bg-[#FAFDEB] px-3.5 py-2.5 text-xs leading-relaxed text-[#3F5A00]">
                TODO: add a companion-app/extension fallback for sites the proxy cannot render.
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <button type="button" onClick={retryFrame} className="btn btn-dark btn-sm">
                  Retry
                </button>
                <button type="button" onClick={exitSession} className="btn btn-outline btn-sm">
                  Close
                </button>
                <button type="button" onClick={endRecording} className="btn btn-outline btn-sm">
                  End automation
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {phase === "stopped" ? (
          <div className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-[2px]">
            <div className="animate-slide-left h-full w-full max-w-2xl overflow-auto bg-[#F7F7F4] p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="display text-[26px] tracking-[-0.02em]">Review and save</h2>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="btn btn-outline btn-sm"
                >
                  Start over
                </button>
              </div>
              <RecorderReview
                steps={snapshot.steps}
                fields={snapshot.fields}
                previews={snapshot.previews}
                previewTotals={snapshot.previewTotals}
                editable
                onChange={(steps: Step[]) => setSnapshot((current) => ({ ...current, steps }))}
              />
              <div className="mt-4">
                <LiveSaveForm
                  name={name}
                  definitionJson={definitionJson}
                  issueCount={outputIssues.length}
                  canSave={snapshot.steps.length > 0}
                  onStartOver={() => window.location.reload()}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="mono flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#0E0F13] text-[13px] text-[#C8F23B]">
          1
        </span>
        <h2 className="display text-[24px] font-bold tracking-[-0.02em]">Start here</h2>
      </div>
      <p className="-mt-2 text-[15px] leading-[1.6] text-[#5C6070]">
        The real site opens full screen in a new tab. Use the floating toolbar to capture data and
        interact with the page to record steps. Come back here after you close that tab.
      </p>

      <div className="flex flex-wrap gap-[18px]">
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-2">
          <label htmlFor="live-name" className="label">
            Automation name
          </label>
          <input
            id="live-name"
            type="text"
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={phase !== "setup" && phase !== "launched"}
            placeholder="Login to my account"
            className={inputClass}
          />
        </div>
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-2">
          <label htmlFor="live-url" className="label">
            Starting URL
          </label>
          <input
            id="live-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            disabled={phase !== "setup" && phase !== "launched"}
            placeholder="https://example.com"
            className={inputClass}
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3.5 rounded-2xl border-[1.5px] border-[#CFE58A] bg-[#FAFDEB] px-5 py-4">
        <input
          type="checkbox"
          checked={captureData}
          onChange={(event) => setCaptureData(event.target.checked)}
          disabled={phase !== "setup" && phase !== "launched"}
          className="mt-0.5 h-5 w-5 shrink-0 rounded accent-[#0E0F13]"
        />
        <span>
          <span className="block text-base font-semibold text-[#14151A]">Capture data from page</span>
          <span className="mt-1 block text-sm leading-[1.55] text-[#4A4E5C]">
            Shows the Thinklessly toolbar over the live site so you can save any table, list, card or
            section as fresh JSON on every run.
          </span>
        </span>
      </label>

      {error ? (
        <p
          role="alert"
          className="animate-fade rounded-xl border border-[#F2C5C0] bg-[#FDE8E6] px-3.5 py-2.5 text-sm text-[#B42318]"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={launchNewTab} className="btn btn-dark btn-lg">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5A4D]" />
          Start recording
        </button>
        <span className="text-sm text-[#5C6070]">Opens the site in a new tab</span>
        {phase === "launched" ? (
          <span className="animate-fade mono w-full text-[12px] text-[#3F5A00]">
            Opened in a new full-screen tab. Finish and save there.
          </span>
        ) : null}
      </div>
    </div>
  );
}