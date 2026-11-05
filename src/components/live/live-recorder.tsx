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

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-800";

const primaryButton =
  "rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

const secondaryButton =
  "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900";

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
      const data = event.data as { __webtomate?: string } | undefined;
      if (!data || typeof data.__webtomate !== "string") return;
      sessionRef.current?.handleMessage(data);
    }
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
    };
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

      const session = new LiveRecorderSession(() => frameRef.current?.frame.contentDocument ?? null);
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

  function endRecording() {
    const session = sessionRef.current;
    if (!session) return;
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
      <div className="fixed inset-0 bg-white dark:bg-black">
        <div ref={containerRef} className="h-full w-full" />

        {phase === "starting" ? (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-white text-sm text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
            Loading the live site...
          </div>
        ) : null}

        {error ? (
          <div className="fixed left-1/2 top-3 z-40 max-w-[min(90vw,32rem)] -translate-x-1/2 rounded-md bg-red-600 px-4 py-2 text-sm text-white shadow-lg">
            {error}
          </div>
        ) : null}

        {phase === "recording" && !failure ? (
          <div className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-zinc-200 bg-white/95 px-2 py-1.5 text-sm shadow-lg backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
            <span className="ml-2 h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Recording</span>
            <button
              type="button"
              onClick={endRecording}
              className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              End automation
            </button>
            <button
              type="button"
              onClick={exitSession}
              className="rounded-full px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        ) : null}

        {failure ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl dark:bg-zinc-950">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{failure.title}</h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{failure.message}</p>
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                TODO: add a companion-app/extension fallback for sites the proxy cannot render.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={retryFrame} className={primaryButton}>
                  Retry
                </button>
                <button type="button" onClick={exitSession} className={secondaryButton}>
                  Close
                </button>
                <button type="button" onClick={endRecording} className={secondaryButton}>
                  End automation
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {phase === "stopped" ? (
          <div className="fixed inset-0 z-40 flex justify-end bg-black/40">
            <div className="h-full w-full max-w-2xl overflow-auto bg-white p-5 shadow-2xl dark:bg-zinc-950">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Review and save</h2>
                <button type="button" onClick={() => window.location.reload()} className={secondaryButton}>
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
    <div className="space-y-4">
      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">1. Start here</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            The real site opens full screen in a new tab. Use the floating toolbar to capture data and interact
            with the page to record steps. Come back here after you close that tab.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="live-name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
          <div className="space-y-1.5">
            <label htmlFor="live-url" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
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

        <label className="flex items-start gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
          <input
            type="checkbox"
            checked={captureData}
            onChange={(event) => setCaptureData(event.target.checked)}
            disabled={phase !== "setup" && phase !== "launched"}
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
          />
          <span>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">Capture data from page</span>
            <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
              Shows the Webtomate toolbar over the live site so you can save any table, list, card or section as
              fresh JSON on every run.
            </span>
          </span>
        </label>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={launchNewTab} className={primaryButton}>
            Start recording
          </button>
          {phase === "launched" ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Opened in a new full-screen tab. Finish and save there.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}