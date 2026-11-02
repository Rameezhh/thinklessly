"use client";

import { useActionState, useState } from "react";
import { outputKeySchema, type ExtractField, type Step } from "@shared/definition";
import { validateStructuredField } from "@shared/outputs";
import { renameOutputsAction, type OutputPanelState } from "@/lib/output-actions";
import { ExtractionTreeEditor } from "./extraction-tree-editor";

type ExtractStep = Extract<Step, { type: "extract" | "extractStructured" }>;
type Edit =
  | { id: string; type: "extract"; outputKey: string }
  | { id: string; type: "extractStructured"; root: ExtractField };

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-800";

function initialEdits(steps: ExtractStep[]): Edit[] {
  return steps.map((step) =>
    step.type === "extract"
      ? { id: step.id, type: "extract", outputKey: step.outputKey }
      : { id: step.id, type: "extractStructured", root: step.root },
  );
}

function editIssues(edits: Edit[]): string[] {
  const issues: string[] = [];
  const keys = new Set<string>();
  for (const edit of edits) {
    const key = edit.type === "extract" ? edit.outputKey : edit.root.key;
    if (!outputKeySchema.safeParse(key).success) issues.push(`Invalid key "${key}"`);
    if (keys.has(key)) issues.push(`Duplicate key "${key}"`);
    keys.add(key);
    if (edit.type === "extractStructured") {
      issues.push(...validateStructuredField(edit.root).map((issue) => issue.message));
    }
  }
  return issues;
}

export function OutputsPanel({
  automationId,
  steps,
}: {
  automationId: string;
  steps: ExtractStep[];
}) {
  const [state, formAction, saving] = useActionState<OutputPanelState, FormData>(
    renameOutputsAction,
    {},
  );
  const [edits, setEdits] = useState<Edit[]>(() => initialEdits(steps));
  const [initial] = useState(() => JSON.stringify(initialEdits(steps)));
  const payload = JSON.stringify({ automationId, edits });
  const issues = editIssues(edits);
  const changed = payload !== initial;

  if (steps.length === 0) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">JSON outputs</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          This automation does not extract any data yet. Re-record it with “Capture data from page” enabled to
          select a table, list, cards, or any element.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">JSON outputs</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Rename keys here at any time. Saving creates a new version; older runs keep their original keys. Each
          run reads fresh values from the page.
        </p>
      </div>

      <form action={formAction} className="mt-4 space-y-4">
        <input type="hidden" name="payload" value={payload} readOnly />

        {edits.map((edit) => {
          if (edit.type === "extract") {
            const valid = outputKeySchema.safeParse(edit.outputKey).success;
            return (
              <div key={edit.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <label className="flex max-w-sm flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Output / JSON key
                  </span>
                  <input
                    value={edit.outputKey}
                    onChange={(event) =>
                      setEdits((current) =>
                        current.map((item) =>
                          item.id === edit.id && item.type === "extract"
                            ? { ...item, outputKey: event.target.value }
                            : item,
                        ),
                      )
                    }
                    spellCheck={false}
                    className={`${inputClass} ${valid ? "" : "border-red-400 dark:border-red-700"}`}
                  />
                </label>
              </div>
            );
          }

          return (
            <div key={edit.id}>
              <ExtractionTreeEditor
                root={edit.root}
                onChange={(root) =>
                  setEdits((current) =>
                    current.map((item) =>
                      item.id === edit.id && item.type === "extractStructured" ? { ...item, root } : item,
                    ),
                  )
                }
              />
            </div>
          );
        })}

        {issues.length > 0 ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            {issues[0]}
            {issues.length > 1 ? ` (+${issues.length - 1} more)` : ""}
          </p>
        ) : null}

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
          disabled={saving || !changed || issues.length > 0}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {saving ? "Saving..." : "Save output keys"}
        </button>
      </form>
    </section>
  );
}
