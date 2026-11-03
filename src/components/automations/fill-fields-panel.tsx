"use client";

import { walkSteps, type Field, type Step } from "@shared/definition";
import { markFieldSecret, setFieldDefault, type FillStep } from "@shared/fields";

type FillEntry = { step: FillStep };

function fillEntries(steps: Step[]): FillEntry[] {
  const entries: FillEntry[] = [];
  walkSteps(steps, (step) => {
    if (step.type === "fill") entries.push({ step });
  });
  return entries;
}

function selectorLabel(step: FillStep): string {
  const selector = step.selectors?.[0];
  return selector ? `${selector.kind}: ${selector.value}` : step.id;
}

export function FillFieldsPanel({
  steps,
  fields,
  editable,
  credentials,
  onFieldsChange,
  onCredentialsChange,
}: {
  steps: Step[];
  fields: Field[];
  editable: boolean;
  credentials: Record<string, string>;
  onFieldsChange: (fields: Field[]) => void;
  onCredentialsChange: (next: Record<string, string>) => void;
}) {
  const entries = fillEntries(steps);

  function updateDefault(field: Field, value: string) {
    onFieldsChange(setFieldDefault(fields, field.key, value));
  }

  function setCredential(key: string, value: string) {
    onCredentialsChange({ ...credentials, [key]: value });
  }

  return (
    <div className="mt-4 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Fill fields
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Every input and upload becomes a payload field. Move any field to credentials to keep it out of
            the payload.
          </p>
        </div>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{entries.length} fill step(s)</span>
      </div>

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Record a text field to see payload and credential options here.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {entries.map((entry) => {
            const value = entry.step.value;
            const field =
              value.mode === "field" ? fields.find((item) => item.key === value.key) : undefined;
            return (
              <li
                key={entry.step.id}
                className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {entry.step.label ?? entry.step.id}
                  </span>
                  {entry.step.value.mode === "literal" ? (
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                      recorded value
                    </span>
                  ) : (
                    <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                      payload
                    </span>
                  )}
                  {field?.secret ? (
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      credential
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">
                  {selectorLabel(entry.step)}
                </p>

                {entry.step.value.mode === "literal" ? (
                  <p className="mt-1 truncate font-mono text-xs text-zinc-600 dark:text-zinc-300">
                    {entry.step.value.text || "(empty)"}
                  </p>
                ) : (
                  <p className="mt-1 font-mono text-xs text-zinc-600 dark:text-zinc-300">
                    field: {entry.step.value.key}
                    {field?.defaultValue !== undefined ? ` · default: ${String(field.defaultValue)}` : ""}
                  </p>
                )}

                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {field?.secret
                    ? "Credential field — the value is attached automatically and omitted from the payload."
                    : "Payload field — optional because a recorded default is available."}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {fields.length > 0 ? (
        <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Payload and credentials
          </p>
          <ul className="mt-2 space-y-2">
            {fields.map((field) => (
              <li
                key={field.key}
                className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{field.label}</span>
                  <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{field.key}</span>
                  <span className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {field.type}
                  </span>
                </div>

                {field.secret ? (
                  <div className="mt-2 space-y-1">
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                      Credential value
                    </label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      disabled={!editable}
                      value={credentials[field.key] ?? ""}
                      onChange={(event) => setCredential(field.key, event.target.value)}
                      placeholder="Saved encrypted when you save the automation"
                      className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-800 dark:disabled:bg-zinc-900"
                    />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Never stored in the payload or sent back by the API.
                    </p>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <label className="min-w-[180px] flex-1 space-y-1">
                      <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        Default payload value
                      </span>
                      <input
                        type={field.type === "number" ? "number" : "text"}
                        disabled={!editable}
                        value={field.defaultValue === undefined ? "" : String(field.defaultValue)}
                        onChange={(event) => updateDefault(field, event.target.value)}
                        className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-800 dark:disabled:bg-zinc-900"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={!editable}
                      onClick={() => onFieldsChange(markFieldSecret(fields, field.key))}
                      className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      Add to credential
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Payload values can be overridden with <code>inputs</code> in the API. Credentials are attached
            automatically and never appear in the payload.
          </p>
        </div>
      ) : null}
    </div>
  );
}
