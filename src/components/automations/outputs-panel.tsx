"use client";

import { useActionState, useState } from "react";
import { outputKeySchema, type ExtractField, type Step } from "@shared/definition";
import { validateStructuredField } from "@shared/outputs";
import { renameOutputsAction, type OutputPanelState } from "@/lib/output-actions";
import { ExtractionTreeEditor } from "./extraction-tree-editor";

type ExtractStep = Extract<Step, { type: "extract" | "extractStructured" | "extractApi" }>;
type Edit =
  | { id: string; type: "extract"; outputKey: string }
  | { id: string; type: "extractStructured"; root: ExtractField }
  | { id: string; type: "extractApi"; outputKey: string };

const inputClass = "field field-sm";

function initialEdits(steps: ExtractStep[]): Edit[] {
  return steps.map((step) => {
    if (step.type === "extract") return { id: step.id, type: "extract", outputKey: step.outputKey };
    if (step.type === "extractApi") return { id: step.id, type: "extractApi", outputKey: step.outputKey };
    return { id: step.id, type: "extractStructured", root: step.root };
  });
}

function editIssues(edits: Edit[]): string[] {
  const issues: string[] = [];
  const keys = new Set<string>();
  for (const edit of edits) {
    const key = edit.type === "extractStructured" ? edit.root.key : edit.outputKey;
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
      <section className="card">
        <h2 className="card-title">JSON outputs</h2>
        <p className="card-desc">
          This automation does not extract any data yet. Re-record it with “Capture data from page” enabled to
          select a table, list, cards, or any element.
        </p>
      </section>
    );
  }

  return (
    <section className="card">
      <div>
        <h2 className="card-title">JSON outputs</h2>
        <p className="card-desc">
          Rename keys here at any time. Saving creates a new version; older runs keep their original keys. Each
          run reads fresh values from the page.
        </p>
      </div>

      <form action={formAction} className="mt-4 space-y-4">
        <input type="hidden" name="payload" value={payload} readOnly />

        {edits.map((edit) => {
          if (edit.type === "extract" || edit.type === "extractApi") {
            const valid = outputKeySchema.safeParse(edit.outputKey).success;
            return (
              <div key={edit.id} className="rounded-2xl border border-[#E5E4DE] bg-white p-4">
                <label className="flex max-w-sm flex-col gap-1">
                  <span className="mono text-[11px] uppercase tracking-[0.06em] text-[#5C6070]">
                    {edit.type === "extractApi" ? "API output / JSON key" : "Output / JSON key"}
                  </span>
                  <input
                    value={edit.outputKey}
                    onChange={(event) =>
                      setEdits((current) =>
                        current.map((item) =>
                          item.id === edit.id && item.type === edit.type
                            ? { ...item, outputKey: event.target.value }
                            : item,
                        ),
                      )
                    }
                    spellCheck={false}
                    className={`${inputClass} ${valid ? "" : "!border-[#B42318]"}`}
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
          <p className="rounded-xl border border-[#CFE58A] bg-[#FAFDEB] px-4 py-3 text-sm text-[#3F5A00]">
            {issues[0]}
            {issues.length > 1 ? ` (+${issues.length - 1} more)` : ""}
          </p>
        ) : null}

        {state.error ? (
          <p
            role="alert"
            className="rounded-xl border border-[#F2C5C0] bg-[#FDE8E6] px-4 py-3 text-sm text-[#B42318]"
          >
            {state.error}
          </p>
        ) : null}

        {state.success ? (
          <p className="rounded-xl border border-emerald-200 bg-[#FAFDEB] px-4 py-3 text-sm text-[#0B6B43]">
            {state.success}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={saving || !changed || issues.length > 0}
          className="btn btn-dark"
        >
          {saving ? "Saving..." : "Save output keys"}
        </button>
      </form>
    </section>
  );
}
