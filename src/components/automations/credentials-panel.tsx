"use client";

import { useActionState } from "react";
import type { Field } from "@shared/definition";
import {
  deleteCredentialAction,
  moveFieldToCredentialsAction,
  saveCredentialsAction,
  type FieldPanelState,
} from "@/lib/automation-field-actions";

const initialState: FieldPanelState = {};

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-800";

const smallButton =
  "rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900";

export function CredentialsPanel({
  automationId,
  fields,
  savedSecretKeys,
}: {
  automationId: string;
  fields: Field[];
  savedSecretKeys: string[];
}) {
  const [state, formAction, saving] = useActionState(
    saveCredentialsAction.bind(null, automationId),
    initialState,
  );
  const saved = new Set(savedSecretKeys);
  const secretFields = fields.filter((field) => field.secret);
  const movableFields = fields.filter((field) => !field.secret);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Credentials</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Encrypted values attached to every run. They are never returned by the API and never accepted in an
          API payload.
        </p>
      </div>

      {secretFields.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-zinc-300 px-3 py-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No credentials yet. Use “Add to credential” while recording, or move a payload field below.
        </p>
      ) : (
        <form action={formAction} className="mt-4 space-y-3">
          {secretFields.map((field) => (
            <div
              key={field.key}
              className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{field.label}</span>
                <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{field.key}</span>
                {saved.has(field.key) ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    saved
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    not set
                  </span>
                )}
              </div>
              <label className="mt-2 block space-y-1">
                <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  {saved.has(field.key) ? "Replace value" : "Value"}
                </span>
                <input
                  type="password"
                  name={`credential:${field.key}`}
                  autoComplete="new-password"
                  placeholder={saved.has(field.key) ? "Leave blank to keep the saved value" : "Enter credential"}
                  className={inputClass}
                />
              </label>
            </div>
          ))}

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
            {saving ? "Saving..." : "Save credentials"}
          </button>
        </form>
      )}

      {secretFields.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {secretFields
            .filter((field) => saved.has(field.key))
            .map((field) => (
              <form key={field.key} action={deleteCredentialAction.bind(null, automationId, field.key)}>
                <button type="submit" className={smallButton}>
                  Delete {field.key}
                </button>
              </form>
            ))}
        </div>
      ) : null}

      {movableFields.length > 0 ? (
        <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Move a payload field to credentials
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            The default value is removed from the definition and must be entered here instead.
          </p>
          <ul className="mt-2 space-y-1">
            {movableFields.map((field) => (
              <li key={field.key} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  <span className="font-mono text-xs">{field.key}</span> · {field.label}
                </span>
                <form action={moveFieldToCredentialsAction.bind(null, automationId, field.key)}>
                  <button type="submit" className={smallButton}>
                    Move to credentials
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
