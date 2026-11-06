"use client";

import { useActionState, useState } from "react";
import type { Field } from "@shared/definition";
import { PlayIcon } from "@/components/brand/icons";
import { startRunAction, type RunFormState } from "@/lib/automation-actions";

const initialState: RunFormState = {};

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
        <div className="rounded-xl bg-[#1A1C23] px-4 py-3.5 text-sm leading-[1.55] text-[#D5D8E2]">
          This automation has no inputs. Running it opens a visible browser on this machine.
        </div>
      ) : null}

      {fields.map((field) => {
        const id = `field-${field.key}`;
        const isSavedSecret = field.secret && saved.has(field.key);

        if (field.type === "checkbox") {
          return (
            <label
              key={field.key}
              htmlFor={id}
              className="flex items-center gap-2.5 text-sm text-[#D5D8E2]"
            >
              <input
                id={id}
                name={`field:${field.key}`}
                type="checkbox"
                checked={Boolean(values[field.key])}
                onChange={(event) => update(field.key, event.target.checked)}
                className="h-4 w-4 rounded accent-[#C8F23B]"
              />
              <span>
                {field.label}
                {field.required ? <span className="text-[#FF8A80]"> *</span> : null}
              </span>
            </label>
          );
        }

        return (
          <div key={field.key} className="space-y-1.5">
            <label
              htmlFor={id}
              className="flex items-center justify-between gap-2 text-sm font-semibold text-[#D5D8E2]"
            >
              <span>
                {field.label}
                {field.required ? <span className="text-[#FF8A80]"> *</span> : null}
              </span>
              {isSavedSecret ? (
                <span className="rounded-full bg-[#12301F] px-2 py-0.5 text-[10px] font-semibold tracking-[0.04em] text-[#5BE49B]">
                  SAVED
                </span>
              ) : null}
            </label>

            {field.type === "file" ? (
              <input
                id={id}
                name={`field:${field.key}`}
                type="file"
                required={field.required}
                className="field field-dark file:mr-3 file:rounded-lg file:border-0 file:bg-[#2A2D38] file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-white"
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
                className="field field-dark"
              />
            )}

            {field.description ? (
              <p className="text-xs leading-relaxed text-[#8A8E9E]">{field.description}</p>
            ) : null}
            {field.type === "file" ? (
              <p className="text-xs text-[#8A8E9E]">Maximum 25 MB.</p>
            ) : null}
          </div>
        );
      })}

      {hasSecret ? (
        <label className="flex items-center gap-2.5 text-sm text-[#D5D8E2]">
          <input
            name="rememberSecrets"
            type="checkbox"
            defaultChecked
            className="h-4 w-4 rounded accent-[#C8F23B]"
          />
          Remember provided secrets for future runs
        </label>
      ) : null}

      {state.error ? (
        <p
          role="alert"
          className="rounded-xl border border-[#5A2520] bg-[#3A1613] px-3.5 py-2.5 text-sm text-[#FF8A80]"
        >
          {state.error}
        </p>
      ) : null}

      <div className="space-y-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="flex h-[54px] w-full items-center justify-center gap-2.5 rounded-[14px] bg-[#C8F23B] text-base font-bold text-[#0E0F13] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#d4ff4a] hover:shadow-[0_12px_30px_rgba(200,242,59,0.25)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0E0F13] border-t-transparent" />
          ) : (
            <PlayIcon size={14} />
          )}
          {pending ? "Starting run..." : "Run now"}
        </button>
        <p className="text-[13px] leading-[1.55] text-[#8A8E9E]">
          The worker opens a visible browser. Progress appears on the run page.
        </p>
      </div>
    </form>
  );
}