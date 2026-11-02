"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import type { Field, Step } from "@shared/definition";
import { outputIssuesForSteps } from "@shared/outputs";
import { importAutomationAction, type ImportAutomationState } from "@/lib/automation-actions";
import { RecorderReview } from "./recorder-review";

type Phase = "setup" | "starting" | "recording" | "stopped";
type Snapshot = {
  startUrl: string;
  captureData: boolean;
  fields: Field[];
  steps: Step[];
  previews: Record<string, unknown>;
};

const initialState: ImportAutomationState = {};

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-800 dark:disabled:bg-zinc-900";

const primaryButton =
  "rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

const secondaryButton =
  "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900";

const emptySnapshot: Snapshot = { startUrl: "", captureData: true, fields: [], steps: [], previews: {} };

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function RecorderPanel({ recorderPort }: { recorderPort: string }) {
  const [state, formAction, saving] = useActionState(importAutomationAction, initialState);
  const [phase, setPhase] = useState<Phase>("setup");
  const [name, setName] = useState("");
  const [startUrl, setStartUrl] = useState("");
  const [captureData, setCaptureData] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const phaseRef = useRef<Phase>("setup");

  const base = `http://127.0.0.1:${recorderPort}`;

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    function stopOnPageHide() {
      const id = sessionIdRef.current;
      if (id && phaseRef.current === "recording") {
        navigator.sendBeacon?.(`${base}/sessions/${id}/stop`);
      }
    }

    window.addEventListener("pagehide", stopOnPageHide);
    return () => {
      window.removeEventListener("pagehide", stopOnPageHide);
      socketRef.current?.close();
      socketRef.current = null;
      const id = sessionIdRef.current;
      if (id && phaseRef.current === "recording") {
        void fetch(`${base}/sessions/${id}/stop`, { method: "POST", keepalive: true }).catch(() => undefined);
      }
    };
  }, [base]);

  const outputIssues = useMemo(() => outputIssuesForSteps(snapshot.steps), [snapshot.steps]);

  const definitionJson = useMemo(() => {
    if (snapshot.steps.length === 0) return "";
    return JSON.stringify({
      version: 1,
      startUrl: snapshot.startUrl,
      fields: snapshot.fields,
      steps: snapshot.steps,
      settings: { stepTimeoutMs: 15000, runTimeoutMs: 300000, allowHumanHelp: true },
    });
  }, [snapshot]);

  function closeSocket() {
    const socket = socketRef.current;
    socketRef.current = null;
    socket?.close();
  }

  function connect(id: string) {
    const socket = new WebSocket(`${base.replace(/^http/, "ws")}/sessions/${id}/ws`);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      let message: {
        type?: string;
        status?: string;
        steps?: Step[];
        fields?: Field[];
        startUrl?: string;
        captureData?: boolean;
        step?: Step;
        stepId?: string;
        preview?: unknown;
        error?: string;
        previews?: Record<string, unknown>;
      };
      try {
        message = JSON.parse(String(event.data)) as typeof message;
      } catch {
        return;
      }

      if (message.type === "snapshot") {
        setSnapshot({
          startUrl: message.startUrl ?? "",
          captureData: message.captureData ?? true,
          fields: message.fields ?? [],
          steps: message.steps ?? [],
          previews: message.previews ?? {},
        });
        if (message.status === "stopped") setPhase("stopped");
        return;
      }
      if (message.type === "step" && message.step) {
        setSnapshot((current) => ({ ...current, steps: [...current.steps, message.step as Step] }));
        return;
      }
      if (message.type === "preview" && message.stepId) {
        setSnapshot((current) => ({
          ...current,
          previews: { ...current.previews, [message.stepId as string]: message.preview },
        }));
        return;
      }
      if (message.type === "capture-error") {
        setError(message.error ?? "Could not capture that selection.");
        return;
      }
      if (message.type === "stopped") {
        setSnapshot((current) => ({
          startUrl: message.startUrl || current.startUrl,
          captureData: message.captureData ?? current.captureData,
          fields: message.fields ?? current.fields,
          steps: message.steps ?? current.steps,
          previews: message.previews ?? current.previews,
        }));
        setPhase("stopped");
      }
    };

    socket.onerror = () => {
      if (socketRef.current === socket) {
        setError("Lost the live recorder connection. Click End automation to finish and save.");
      }
    };

    socket.onclose = () => {
      if (socketRef.current === socket) socketRef.current = null;
    };
  }

  async function startRecording() {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Enter a name for the automation.");
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(startUrl.trim());
    } catch {
      setError("Enter a valid starting URL.");
      return;
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      setError("The starting URL must use http:// or https://.");
      return;
    }

    setPhase("starting");
    setSnapshot({ ...emptySnapshot, startUrl: parsedUrl.toString(), captureData });

    try {
      const response = await fetch(`${base}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startUrl: parsedUrl.toString(), captureData }),
      });
      const data = (await response.json().catch(() => ({}))) as { sessionId?: string; error?: string };
      if (!response.ok || !data.sessionId) {
        throw new Error(data.error ?? "Could not start the recorder.");
      }

      sessionIdRef.current = data.sessionId;
      setSessionId(data.sessionId);
      setPhase("recording");
      connect(data.sessionId);
    } catch (startError) {
      setPhase("setup");
      setSessionId(null);
      sessionIdRef.current = null;
      setError(
        startError instanceof TypeError
          ? "Recorder service is not reachable. Make sure pnpm dev is running."
          : errorText(startError),
      );
    }
  }

  async function endRecording() {
    const id = sessionIdRef.current;
    if (!id) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`${base}/sessions/${id}/stop`, { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as Snapshot & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not finish the recording.");

      setSnapshot({
        startUrl: data.startUrl ?? startUrl,
        captureData: data.captureData ?? captureData,
        fields: Array.isArray(data.fields) ? data.fields : [],
        steps: Array.isArray(data.steps) ? data.steps : [],
        previews: data.previews ?? {},
      });
      setPhase("stopped");
      closeSocket();
    } catch (stopError) {
      setError(errorText(stopError));
    } finally {
      setBusy(false);
    }
  }

  async function cancelRecording() {
    const id = sessionIdRef.current;
    setBusy(true);
    setError(null);
    try {
      if (id) await fetch(`${base}/sessions/${id}`, { method: "DELETE" }).catch(() => undefined);
    } finally {
      closeSocket();
      sessionIdRef.current = null;
      setSessionId(null);
      setSnapshot({ ...emptySnapshot, captureData });
      setPhase("setup");
      setBusy(false);
    }
  }

  function startOver() {
    closeSocket();
    sessionIdRef.current = null;
    setSessionId(null);
    setSnapshot({ ...emptySnapshot, captureData });
    setPhase("setup");
    setError(null);
  }

  const recording = phase === "recording" || phase === "starting";

  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">1. Start here</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              A Chromium window will open at your URL. Record clicks and forms, and optionally capture page data
              as JSON.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {snapshot.captureData ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                Data capture on
              </span>
            ) : null}
            {phase === "recording" ? (
              <span className="flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                Recording
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="recorder-name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Automation name
            </label>
            <input
              id="recorder-name"
              type="text"
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={recording || phase === "stopped"}
              placeholder="Login to my account"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="recorder-url" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Starting URL
            </label>
            <input
              id="recorder-url"
              type="url"
              value={startUrl}
              onChange={(event) => setStartUrl(event.target.value)}
              disabled={phase !== "setup"}
              placeholder="https://example.com"
              className={inputClass}
            />
          </div>
        </div>

        <label className="flex items-start gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
          <input
            type="checkbox"
            checked={captureData}
            onChange={(event) => {
              setCaptureData(event.target.checked);
              setSnapshot((current) => ({ ...current, captureData: event.target.checked }));
            }}
            disabled={phase !== "setup"}
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
          />
          <span>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">Capture data from page</span>
            <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
              Shows a floating toolbar in the browser. Select any table, list, card, section, or div to save a
              live JSON output. Values are extracted fresh on every run.
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

        {phase === "setup" ? (
          <button type="button" onClick={() => void startRecording()} className={primaryButton}>
            Start recording
          </button>
        ) : null}

        {phase === "starting" ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Opening the recording browser...</p>
        ) : null}

        {phase === "recording" ? (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void endRecording()} disabled={busy} className={primaryButton}>
              {busy ? "Stopping..." : "End automation"}
            </button>
            <button type="button" onClick={() => void cancelRecording()} disabled={busy} className={secondaryButton}>
              Cancel recording
            </button>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Use the Chromium window{snapshot.captureData ? " and the Webtomate data toolbar" : ""}, then click
              End automation.
            </p>
            {!snapshot.captureData ? (
              <p className="w-full rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                Data capture is off for this session, so the toolbar is hidden. Cancel recording and start again
                with “Capture data from page” enabled.
              </p>
            ) : null}
          </div>
        ) : null}

        {phase === "stopped" ? (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="name" value={name} />
            <input type="hidden" name="definitionJson" value={definitionJson} />
            {state.error ? (
              <p
                role="alert"
                className="whitespace-pre-line rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
              >
                {state.error}
              </p>
            ) : null}
            {outputIssues.length > 0 ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                Fix the JSON key issue above before saving.
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving || busy || snapshot.steps.length === 0 || outputIssues.length > 0}
                className={primaryButton}
              >
                {saving ? "Saving..." : "Save automation"}
              </button>
              <button type="button" onClick={startOver} disabled={saving} className={secondaryButton}>
                Start over
              </button>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Saves version 1 and opens the automation page.
              </p>
            </div>
          </form>
        ) : null}
      </section>

      {phase === "recording" || phase === "stopped" || snapshot.steps.length > 0 ? (
        <RecorderReview
          steps={snapshot.steps}
          fields={snapshot.fields}
          previews={snapshot.previews}
          editable={phase === "stopped"}
          onChange={(steps) => setSnapshot((current) => ({ ...current, steps }))}
        />
      ) : null}

      {phase === "setup" ? (
        <section className="rounded-xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          <p className="font-medium text-zinc-700 dark:text-zinc-300">How recording works</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Enter a name and the page where the flow starts.</li>
            <li>Leave data capture on if you want the in-browser JSON picker.</li>
            <li>Start recording and interact with the Chromium window.</li>
            <li>Click End automation, rename JSON keys if needed, then save.</li>
          </ol>
        </section>
      ) : null}

      {sessionId ? <p className="sr-only">Recording session {sessionId}</p> : null}
    </div>
  );
}
