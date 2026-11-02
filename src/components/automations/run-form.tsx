"use client";

import { useActionState, useState } from "react";
import type { Field } from "@shared/definition";
import { startRunAction, type RunFormState } from "@/lib/automation-actions";

const initialState: RunFormState = {};

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-800";

function initialValues(fields: Field[]): Record<string, string | boolean> {
  const values: Record<string, string | boolean> = {};
  for (const field of fields) {
    if (field.type === "checkbox") {
      values[field.key] = Boolean(field.defaultValue);
    } else if (field.secret) {
      values[field.key] = "";
    } else {
      values[field.key] = field.defaultValue === undefined ? "" : String(field.defaultValue);
    }
  }
  return values;
}

export function RunForm({
  automationId,
  fields,
  savedSecretKeys,
}: {
  automationId: string;
  fields: Field[];
  savedSecretKeys: string[];
}) {
  const action = startRunAction.bind(null, automationId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [values, setValues] = useState<Record<string, string | boolean>>(() => initialValues(fields));
  const saved = new Set(savedSecretKeys);
  const hasSecret = fields.some((field) => field.secret);

  function update(key: string, value: string | boolean) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  return (
    <form action={formAction} className="space-y-4">
      {fields.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          This automation has no inputs. Running it opens a visible browser on this machine.
        </p>
      ) : null}

      {fields.map((field) => {
        const id = `field-${field.key}`;
        const isSavedSecret = field.secret && saved.has(field.key);

        if (field.type === "checkbox") {
          return (
            <label key={field.key} htmlFor={id} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                id={id}
                name={`field:${field.key}`}
                type="checkbox"
                checked={Boolean(values[field.key])}
                onChange={(event) => update(field.key, event.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
              />
              <span>
                {field.label}
                {field.required ? <span className="text-red-600 dark:text-red-400"> *</span> : null}
              </span>
            </label>
          );
        }

        return (
          <div key={field.key} className="space-y-1.5">
            <label htmlFor={id} className="flex items-center justify-between gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <span>
                {field.label}
                {field.required ? <span className="text-red-600 dark:text-red-400"> *</span> : null}
              </span>
              {isSavedSecret ? (
                <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">saved</span>
              ) : null}
            </label>

            {field.type === "file" ? (
              <input
                id={id}
                name={`field:${field.key}`}
                type="file"
                required={field.required}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 file:mr-3 file:rounded file:border-0 file:bg-zinc-100 file:px-2 file:py-1 file:text-xs file:font-medium dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:file:bg-zinc-800"
              />
            ) : (
              <input
                id={id}
                name={`field:${field.key}`}
                type={field.secret ? "password" : field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
                required={field.required && !isSavedSecret}
                autoComplete={field.secret ? "off" : undefined}
                value={String(values[field.key] ?? "")}
                onChange={(event) => update(field.key, event.target.value)}
                placeholder={isSavedSecret ? "Saved secret available — leave blank to keep it" : undefined}
                className={inputClass}
              />
            )}

            {field.description ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{field.description}</p>
            ) : null}
            {field.type === "file" ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Maximum 25 MB.</p>
            ) : null}
          </div>
        );
      })}

      {hasSecret ? (
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            name="rememberSecrets"
            type="checkbox"
            defaultChecked
            className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
          />
          Remember provided secrets for future runs
        </label>
      ) : null}

      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {state.error}
        </p>
      ) : null}

      <div className="space-y-2">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Starting run..." : "Run now"}
        </button>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          The worker opens a visible browser. Progress appears on the run page.
        </p>
      </div>
    </form>
  );
}
