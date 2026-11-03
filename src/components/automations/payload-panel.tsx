"use client";

import { useActionState, useMemo, useState } from "react";
import type { Field } from "@shared/definition";
import { savePayloadDefaultsAction, type FieldPanelState } from "@/lib/automation-field-actions";

const initialState: FieldPanelState = {};

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-800";

function initialValues(fields: Field[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    if (field.secret) continue;
    values[field.key] = field.defaultValue === undefined ? "" : String(field.defaultValue);
  }
  return values;
}

function buildPayload(fields: Field[], values: Record<string, string>): { inputs: Record<string, unknown> } {
  const inputs: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.secret) continue;
    const raw = values[field.key] ?? "";
    if (field.type === "checkbox") {
      inputs[field.key] = raw === "true" || raw === "on";
      continue;
    }
    if (field.type === "number") {
      if (raw.trim() === "") {
        inputs[field.key] = "";
        continue;
      }
      const number = Number(raw);
      inputs[field.key] = Number.isFinite(number) ? number : raw;
      continue;
    }
    inputs[field.key] = raw;
  }
  return { inputs };
}

export function PayloadPanel({
  automationId,
  fields,
}: {
  automationId: string;
  fields: Field[];
}) {
  const [state, formAction, saving] = useActionState(
    savePayloadDefaultsAction.bind(null, automationId),
    initialState,
  );
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(fields));
  const [copied, setCopied] = useState<"json" | "curl" | null>(null);

  const editable = fields.filter((field) => !field.secret);
  const credentials = fields.filter((field) => field.secret);
  const payload = useMemo(() => buildPayload(fields, values), [fields, values]);
  const payloadJson = JSON.stringify(payload, null, 2);
  const endpoint = `/api/v1/automations/${automationId}/runs`;
  const curl = `curl -X POST http://localhost:3000${endpoint} \\
  -H "Authorization: Bearer wtm_..." \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: order-123" \\
  --data-binary @payload.json`;

  function update(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setCopied(null);
  }

  async function copy(value: string, kind: "json" | "curl") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Payload</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Every recorded input and upload is included automatically. Recorded values become optional
            defaults; override any key from the API, triggers, or a manual run.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void copy(payloadJson, "json")}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {copied === "json" ? "Copied" : "Copy JSON"}
        </button>
      </div>

      {editable.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed border-zinc-300 px-3 py-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          <p>No payload fields yet. Re-record a flow that fills an input or uploads a file.</p>
          {credentials.length > 0 ? (
            <p className="mt-1">
              All current fields are credentials and are attached automatically:{" "}
              {credentials.map((field) => field.key).join(", ")}.
            </p>
          ) : null}
        </div>
      ) : (
        <form action={formAction} className="mt-4 space-y-4">
          <input type="hidden" name="values" value={JSON.stringify(values)} readOnly />

          <div className="grid gap-3 sm:grid-cols-2">
            {editable.map((field) => {
              const id = `payload-${field.key}`;
              if (field.type === "checkbox") {
                return (
                  <label
                    key={field.key}
                    htmlFor={id}
                    className="flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                  >
                    <input
                      id={id}
                      type="checkbox"
                      checked={values[field.key] === "true"}
                      onChange={(event) => update(field.key, event.target.checked ? "true" : "false")}
                      className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
                    />
                    <span className="text-zinc-700 dark:text-zinc-300">{field.label}</span>
                    <span className="ml-auto font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                      {field.key}
                    </span>
                  </label>
                );
              }
              return (
                <div key={field.key} className="space-y-1">
                  <label
                    htmlFor={id}
                    className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300"
                  >
                    <span>
                      {field.label}
                      {field.type === "file" ? (
                        <span className="ml-1 text-[10px] uppercase tracking-wide text-zinc-400">path</span>
                      ) : null}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{field.key}</span>
                  </label>
                  <input
                    id={id}
                    type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
                    value={values[field.key] ?? ""}
                    onChange={(event) => update(field.key, event.target.value)}
                    placeholder={field.type === "number" ? "0" : field.type === "file" ? "/path/to/file" : ""}
                    className={inputClass}
                  />
                </div>
              );
            })}
          </div>

          {credentials.length > 0 ? (
            <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              <p>
                {credentials.length} credential(s) are attached automatically and never appear in this
                payload: {credentials.map((field) => field.key).join(", ")}.
              </p>
            </div>
          ) : null}

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                API request
              </p>
              <button
                type="button"
                onClick={() => void copy(curl, "curl")}
                className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                {copied === "curl" ? "Copied" : "Copy curl"}
              </button>
            </div>
            <pre className="max-h-44 overflow-auto rounded-lg bg-zinc-950 p-4 font-mono text-[11px] leading-relaxed text-zinc-100 dark:bg-black">
              {curl}
            </pre>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Save the JSON below as <code>payload.json</code>. Adjust the host if your dev server uses
              another port. Secrets are read from saved credentials, never from this body.
            </p>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              payload.json
            </p>
            <pre className="max-h-56 overflow-auto rounded-lg bg-zinc-950 p-4 font-mono text-[11px] leading-relaxed text-zinc-100 dark:bg-black">
              {payloadJson}
            </pre>
          </div>

          {state.error ? (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
            >
              {state.error}
            </p>
          ) : null}

          {state.success ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              {state.success}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {saving ? "Saving..." : "Save payload defaults"}
          </button>
        </form>
      )}
    </section>
  );
}
