"use client";

import { useActionState, useState } from "react";
import {
  createCronTriggerAction,
  createDelayTriggerAction,
  deleteTriggerAction,
  toggleTriggerAction,
  type TriggerFormState,
} from "@/lib/trigger-actions";

export type TriggerRow = {
  id: string;
  type: string;
  cronExpression: string | null;
  timezone: string | null;
  delaySeconds: number | null;
  enabled: boolean;
  nextRunAt: string | null;
  lastFiredAt: string | null;
};

const initialState: TriggerFormState = {};

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-800";

export function TriggersPanel({
  automationId,
  triggers,
  defaultTimezone,
}: {
  automationId: string;
  triggers: TriggerRow[];
  defaultTimezone: string;
}) {
  const cronAction = createCronTriggerAction.bind(null, automationId);
  const delayAction = createDelayTriggerAction.bind(null, automationId);
  const [cronState, cronFormAction, cronPending] = useActionState(cronAction, initialState);
  const [delayState, delayFormAction, delayPending] = useActionState(delayAction, initialState);
  const [cronExpression, setCronExpression] = useState("0 9 * * *");
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [cronInputs, setCronInputs] = useState("{}");
  const [delaySeconds, setDelaySeconds] = useState("60");
  const [delayInputs, setDelayInputs] = useState("{}");

  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Triggers</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Triggers use saved secrets. Save secret values with a manual run first. Non-secret inputs can be set as a
          JSON object.
        </p>
      </div>

      <div className="grid gap-5 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800 md:grid-cols-2">
        <form action={cronFormAction} className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Cron schedule</h3>
          <div className="space-y-1.5">
            <label htmlFor="cron-expression" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Cron expression
            </label>
            <input
              id="cron-expression"
              name="cronExpression"
              type="text"
              required
              value={cronExpression}
              onChange={(event) => setCronExpression(event.target.value)}
              className={`${inputClass} font-mono`}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="cron-timezone" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Timezone
            </label>
            <input
              id="cron-timezone"
              name="timezone"
              type="text"
              required
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="cron-inputs" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Inputs JSON
            </label>
            <input
              id="cron-inputs"
              name="inputsJson"
              type="text"
              value={cronInputs}
              onChange={(event) => setCronInputs(event.target.value)}
              className={`${inputClass} font-mono`}
            />
          </div>
          {cronState.error ? (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {cronState.error}
            </p>
          ) : cronState.ok ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">Cron trigger added.</p>
          ) : null}
          <button
            type="submit"
            disabled={cronPending}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {cronPending ? "Adding..." : "Add cron trigger"}
          </button>
        </form>

        <form action={delayFormAction} className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">One-time delay</h3>
          <div className="space-y-1.5">
            <label htmlFor="delay-seconds" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Run after (seconds)
            </label>
            <input
              id="delay-seconds"
              name="delaySeconds"
              type="number"
              min={5}
              max={604800}
              required
              value={delaySeconds}
              onChange={(event) => setDelaySeconds(event.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="delay-inputs" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Inputs JSON
            </label>
            <input
              id="delay-inputs"
              name="inputsJson"
              type="text"
              value={delayInputs}
              onChange={(event) => setDelayInputs(event.target.value)}
              className={`${inputClass} font-mono`}
            />
          </div>
          {delayState.error ? (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {delayState.error}
            </p>
          ) : delayState.ok ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">Delay trigger added.</p>
          ) : null}
          <button
            type="submit"
            disabled={delayPending}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {delayPending ? "Adding..." : "Add delay trigger"}
          </button>
        </form>
      </div>

      {triggers.length === 0 ? (
        <p className="px-5 py-6 text-sm text-zinc-500 dark:text-zinc-400">No triggers yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {triggers.map((trigger) => (
            <li key={trigger.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {trigger.type === "CRON" ? "Cron" : "One-time delay"}
                  <span
                    className={`ml-2 text-xs font-normal ${trigger.enabled ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"}`}
                  >
                    {trigger.enabled ? "enabled" : "disabled"}
                  </span>
                </p>
                <p className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                  {trigger.type === "CRON"
                    ? `${trigger.cronExpression} · ${trigger.timezone ?? "UTC"}`
                    : `after ${trigger.delaySeconds ?? "?"} seconds`}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  next {trigger.nextRunAt ?? "—"} · last fired {trigger.lastFiredAt ?? "never"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <form action={toggleTriggerAction.bind(null, trigger.id)}>
                  <button
                    type="submit"
                    className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    {trigger.enabled ? "Disable" : "Enable"}
                  </button>
                </form>
                <form action={deleteTriggerAction.bind(null, trigger.id)}>
                  <button
                    type="submit"
                    className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
                  >
                    Delete
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
