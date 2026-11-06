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

const inputClass = "field";

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
    <section className="card">
      <div className="border-b px-7 py-6 border-b border-[#E5E4DE]">
        <h2 className="card-title">Triggers</h2>
        <p className="card-desc">
          Triggers use saved secrets. Save secret values with a manual run first. Non-secret inputs can be set as a
          JSON object.
        </p>
      </div>

      <div className="grid gap-5 border-b px-7 py-6 border-b border-[#E5E4DE] md:grid-cols-2">
        <form action={cronFormAction} className="space-y-3">
          <h3 className="text-[16px] font-semibold">Cron schedule</h3>
          <div className="space-y-1.5">
            <label htmlFor="cron-expression" className="block mono text-[12px] uppercase tracking-[0.06em] text-[#5C6070]">
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
            <label htmlFor="cron-timezone" className="block mono text-[12px] uppercase tracking-[0.06em] text-[#5C6070]">
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
            <label htmlFor="cron-inputs" className="block mono text-[12px] uppercase tracking-[0.06em] text-[#5C6070]">
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
            <p role="alert" className="text-sm text-[#B42318]">
              {cronState.error}
            </p>
          ) : cronState.ok ? (
            <p className="text-sm text-[#0B6B43]">Cron trigger added.</p>
          ) : null}
          <button
            type="submit"
            disabled={cronPending}
            className="btn btn-dark btn-sm"
          >
            {cronPending ? "Adding..." : "Add cron trigger"}
          </button>
        </form>

        <form action={delayFormAction} className="space-y-3">
          <h3 className="text-[16px] font-semibold">One-time delay</h3>
          <div className="space-y-1.5">
            <label htmlFor="delay-seconds" className="block mono text-[12px] uppercase tracking-[0.06em] text-[#5C6070]">
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
            <label htmlFor="delay-inputs" className="block mono text-[12px] uppercase tracking-[0.06em] text-[#5C6070]">
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
            <p role="alert" className="text-sm text-[#B42318]">
              {delayState.error}
            </p>
          ) : delayState.ok ? (
            <p className="text-sm text-[#0B6B43]">Delay trigger added.</p>
          ) : null}
          <button
            type="submit"
            disabled={delayPending}
            className="btn btn-dark btn-sm"
          >
            {delayPending ? "Adding..." : "Add delay trigger"}
          </button>
        </form>
      </div>

      {triggers.length === 0 ? (
        <p className="px-7 py-6 text-sm text-[#5C6070]">No triggers yet.</p>
      ) : (
        <ul className="divide-y divide-[#EFEEE8]">
          {triggers.map((trigger) => (
            <li key={trigger.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="text-[16px] font-semibold">
                  {trigger.type === "CRON" ? "Cron" : "One-time delay"}
                  <span
                    className={`ml-2 text-xs font-normal ${trigger.enabled ? "text-[#0B6B43]" : "text-[#8A8E9E]"}`}
                  >
                    {trigger.enabled ? "enabled" : "disabled"}
                  </span>
                </p>
                <p className="mono text-xs text-[#5C6070]">
                  {trigger.type === "CRON"
                    ? `${trigger.cronExpression} · ${trigger.timezone ?? "UTC"}`
                    : `after ${trigger.delaySeconds ?? "?"} seconds`}
                </p>
                <p className="text-xs text-[#5C6070]">
                  next {trigger.nextRunAt ?? "—"} · last fired {trigger.lastFiredAt ?? "never"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <form action={toggleTriggerAction.bind(null, trigger.id)}>
                  <button
                    type="submit"
                    className="btn btn-outline btn-xs"
                  >
                    {trigger.enabled ? "Disable" : "Enable"}
                  </button>
                </form>
                <form action={deleteTriggerAction.bind(null, trigger.id)}>
                  <button
                    type="submit"
                    className="btn btn-danger btn-xs"
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
