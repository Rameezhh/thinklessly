"use client";

import { outputKeySchema, type ExtractField, type Field, type Step } from "@shared/definition";
import { outputIssuesForSteps } from "@shared/outputs";
import { ExtractionTreeEditor } from "./extraction-tree-editor";

type Props = {
  steps: Step[];
  fields: Field[];
  previews: Record<string, unknown>;
  previewTotals?: Record<string, number>;
  editable: boolean;
  onChange: (steps: Step[]) => void;
};

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-800 dark:disabled:bg-zinc-900";

function stepDetail(step: Step): string {
  if (step.type === "goto") return step.url;
  if (step.type === "fill") {
    if (step.value.mode === "field") return `field: ${step.value.key}`;
    return step.value.text ? `"${step.value.text}"` : "empty value";
  }
  if (step.type === "select") {
    if (typeof step.value === "string") return step.value || "empty value";
    return step.value.mode === "field" ? `field: ${step.value.key}` : step.value.text || "empty value";
  }
  if (step.type === "check") {
    if (typeof step.checked === "boolean") return step.checked ? "checked" : "unchecked";
    return `field: ${step.checked.key}`;
  }
  if (step.type === "upload") return `field: ${step.fieldKey}`;
  if (step.type === "press") return step.key;
  if (step.type === "extract") return `output: ${step.outputKey}`;
  if (step.type === "extractStructured") return `JSON output: ${step.root.key}`;
  if (step.type === "wait") return `${step.kind}: ${String(step.value)}`;
  if (step.type === "screenshot") return step.name;
  if (step.type === "assert") return [step.kind, step.value].filter(Boolean).join(" ");
  if ("selectors" in step && step.selectors?.[0]) {
    const selector = step.selectors[0];
    const name = selector.name ? ` "${selector.name}"` : "";
    return `${selector.kind}: ${selector.value}${name}`.slice(0, 140);
  }
  return step.type;
}

function updateStep(steps: Step[], index: number, next: Step): Step[] {
  return steps.map((step, current) => (current === index ? next : step));
}

function SingleKeyEditor({
  step,
  disabled,
  onChange,
}: {
  step: Extract<Step, { type: "extract" }>;
  disabled: boolean;
  onChange: (key: string) => void;
}) {
  const valid = outputKeySchema.safeParse(step.outputKey).success;
  return (
    <label className="mt-2 flex max-w-sm flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Output / JSON key
      </span>
      <input
        value={step.outputKey}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        spellCheck={false}
        className={`${inputClass} ${valid ? "" : "border-red-400 dark:border-red-700"}`}
      />
    </label>
  );
}

export function RecorderReview({ steps, fields, previews, previewTotals, editable, onChange }: Props) {
  const issues = outputIssuesForSteps(steps);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {editable ? "2. Review and save" : "Recorded steps"}
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {editable
              ? "Rename JSON keys before saving. Captured values stay live and are read again on every run."
              : "Steps and data fields appear here as you work in the browser."}
          </p>
        </div>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{steps.length} steps</span>
      </div>

      {issues.length > 0 ? (
        <p
          role="alert"
          className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {issues[0]?.message}
          {issues.length > 1 ? ` (+${issues.length - 1} more)` : ""}
        </p>
      ) : null}

      {steps.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Interact with the browser window. Steps will appear here as you work.
        </p>
      ) : (
        <ol className="mt-4 max-h-[36rem] space-y-2 overflow-auto pr-1">
          {steps.map((step, index) => {
            const preview = step.type === "extractStructured" ? previews[step.id] : undefined;
            const previewTotal = step.type === "extractStructured" ? previewTotals?.[step.id] : undefined;
            const itemCount =
              previewTotal ?? (Array.isArray(preview) ? preview.length : undefined);
            return (
              <li
                key={step.id}
                className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 w-6 shrink-0 text-right text-xs text-zinc-400">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 break-words font-medium text-zinc-900 dark:text-zinc-100">
                        {step.label ?? step.type}
                      </span>
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                        {step.type === "extractStructured" ? "data" : step.type}
                      </span>
                      {!step.enabled ? (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">disabled</span>
                      ) : null}
                      {step.optional ? (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">optional</span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">
                      {stepDetail(step)}
                    </p>

                    {step.type === "extract" ? (
                      <SingleKeyEditor
                        step={step}
                        disabled={!editable}
                        onChange={(key) => onChange(updateStep(steps, index, { ...step, outputKey: key }))}
                      />
                    ) : null}

                    {step.type === "extractStructured" ? (
                      <div className="mt-3">
                        <ExtractionTreeEditor
                          root={step.root}
                          disabled={!editable}
                          onChange={(root: ExtractField) =>
                            onChange(updateStep(steps, index, { ...step, root }))
                          }
                        />
                        {preview !== undefined ? (
                          <details className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                            <summary className="cursor-pointer text-xs font-medium text-zinc-600 dark:text-zinc-300">
                              Sample JSON from the page
                              {itemCount !== undefined ? ` (${itemCount} item${itemCount === 1 ? "" : "s"})` : ""}
                            </summary>
                            <pre className="mt-2 max-h-[28rem] overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-[11px] leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                              {JSON.stringify(preview, null, 2)}
                            </pre>
                            <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                              This is the full data captured for this step. Each run reads it fresh from the page.
                            </p>
                          </details>
                        ) : editable ? (
                          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                            No sample preview was captured for this field.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {fields.length > 0 ? (
        <div className="mt-4 rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Run-time inputs
          </p>
          <ul className="mt-2 space-y-1">
            {fields.map((field) => (
              <li key={field.key} className="text-sm text-zinc-700 dark:text-zinc-300">
                <span className="font-mono text-xs">{field.key}</span> · {field.label} · {field.type}
                {field.secret ? " · secret" : ""}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Password and file values are never recorded. You will enter them when running the automation.
          </p>
        </div>
      ) : null}
    </section>
  );
}
