"use client";

import { useState, useTransition } from "react";
import type { AutomationDefinition, ExtractField, Step } from "@shared/definition";
import {
  convertFillToCredentialAction,
  convertFillToPayloadAction,
  reorderStepsAction,
  setFieldRequiredAction,
  setStepOptionalAction,
} from "@/lib/automation-field-actions";

const smallButton =
  "rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900";

function stepDetail(step: Step): string | null {
  switch (step.type) {
    case "goto":
      return step.url;
    case "fill":
      return step.value.mode === "field" ? `field: ${step.value.key}` : step.value.text;
    case "select":
      return step.value;
    case "check":
      return step.checked ? "checked" : "unchecked";
    case "upload":
      return `field: ${step.fieldKey}`;
    case "press":
      return step.key;
    case "wait":
      return `${step.kind}: ${String(step.value)}`;
    case "extract":
      return `output: ${step.outputKey}`;
    case "extractStructured":
      return `JSON output: ${step.root.key}`;
    case "screenshot":
      return step.name;
    case "assert":
      return [step.kind, step.value].filter(Boolean).join(" ");
    default:
      return null;
  }
}

function selectorsFor(step: Step) {
  return "selectors" in step && step.selectors ? step.selectors : [];
}

function fieldLines(field: ExtractField, depth = 0): string[] {
  const kind =
    field.kind === "value"
      ? `${field.attribute || "text"}`
      : field.kind === "list"
        ? `list ≤${field.limit}`
        : "object";
  const lines = [`${"  ".repeat(depth)}${field.key}: ${kind}`];
  if (field.kind !== "value") {
    for (const child of field.fields) lines.push(...fieldLines(child, depth + 1));
  }
  return lines;
}

function ImportantToggle({
  automationId,
  stepId,
  optional,
}: {
  automationId: string;
  stepId: string;
  optional: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
      <input
        type="checkbox"
        checked={!optional}
        disabled={pending}
        onChange={(event) => {
          const important = event.target.checked;
          startTransition(() => {
            void setStepOptionalAction(automationId, stepId, !important);
          });
        }}
        className="h-3.5 w-3.5 rounded border-zinc-300 dark:border-zinc-700"
      />
      Important
    </label>
  );
}

function RequiredToggle({
  automationId,
  fieldKey,
  required,
}: {
  automationId: string;
  fieldKey: string;
  required: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
      <input
        type="checkbox"
        checked={required}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.checked;
          startTransition(() => {
            void setFieldRequiredAction(automationId, fieldKey, next);
          });
        }}
        className="h-3.5 w-3.5 rounded border-zinc-300 dark:border-zinc-700"
      />
      Required
    </label>
  );
}

export function DefinitionView({
  automationId,
  definition,
}: {
  automationId: string;
  definition: AutomationDefinition;
}) {
  const [order, setOrder] = useState<string[]>(() => definition.steps.map((s) => s.id));
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const stepsById = new Map(definition.steps.map((s) => [s.id, s]));
  const orderedSteps = order.map((id) => stepsById.get(id)).filter(Boolean) as Step[];

  function moveStep(dragId: string, targetId: string) {
    if (dragId === targetId) return;
    const next = order.filter((id) => id !== dragId);
    const targetIndex = next.indexOf(targetId);
    if (targetIndex < 0) return;
    next.splice(targetIndex, 0, dragId);
    setOrder(next);
    startTransition(() => { void reorderStepsAction(automationId, next); });
  }

  function moveOffset(stepId: string, delta: number) {
    const currentIndex = order.indexOf(stepId);
    if (currentIndex < 0) return;
    const next = [...order];
    const targetIndex = currentIndex + delta;
    if (targetIndex < 0 || targetIndex >= next.length) return;
    [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
    setOrder(next);
    startTransition(() => { void reorderStepsAction(automationId, next); });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Inputs</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Values are supplied at run time. Uncheck “Required” to make an input optional. Secrets are encrypted
            at rest and never shown again.
          </p>
        </div>
        {definition.fields.length === 0 ? (
          <p className="px-5 py-4 text-sm text-zinc-500 dark:text-zinc-400">No inputs.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="px-5 py-2 font-medium">Label</th>
                <th className="px-5 py-2 font-medium">Key</th>
                <th className="px-5 py-2 font-medium">Type</th>
                <th className="px-5 py-2 font-medium">Important</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {definition.fields.map((field) => (
                <tr key={field.key}>
                  <td className="px-5 py-2 text-zinc-900 dark:text-zinc-100">{field.label}</td>
                  <td className="px-5 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">{field.key}</td>
                  <td className="px-5 py-2 text-zinc-600 dark:text-zinc-400">
                    {field.type}
                    {field.secret ? (
                      <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">secret</span>
                    ) : null}
                  </td>
                  <td className="px-5 py-2">
                    <RequiredToggle automationId={automationId} fieldKey={field.key} required={field.required} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Steps</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {definition.steps.length} step(s) · start URL: {definition.startUrl}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Uncheck “Important” on a step to skip it when its element is missing instead of failing the run.
          </p>
        </div>
        <ol className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {orderedSteps.map((step, index) => {
            const selectors = selectorsFor(step);
            const detail = stepDetail(step);
            return (
              <li
                key={step.id}
                draggable
                onDragStart={() => setDragging(step.id)}
                onDragEnd={() => { setDragging(null); setDragOverId(null); }}
                onDragOver={(event) => { event.preventDefault(); setDragOverId(step.id); }}
                onDrop={(event) => { event.preventDefault(); if (dragging) moveStep(dragging, step.id); setDragging(null); setDragOverId(null); }}
                className={`flex gap-4 px-5 py-3 ${dragOverId === step.id ? "ring-2 ring-zinc-500 bg-zinc-50 dark:ring-zinc-400 dark:bg-zinc-800/50" : ""}`}
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {step.type}
                    </span>
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {step.label ?? step.id}
                    </span>
                    {!step.enabled ? (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">disabled</span>
                    ) : null}
                    {step.optional ? (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">optional</span>
                    ) : null}
                    <span className="ml-auto">
                      <ImportantToggle automationId={automationId} stepId={step.id} optional={step.optional} />
                      <button
                        type="button"
                        onClick={() => moveOffset(step.id, -1)}
                        disabled={index === 0}
                        className={smallButton}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveOffset(step.id, 1)}
                        disabled={index === orderedSteps.length - 1}
                        className={smallButton}
                      >
                        ↓
                      </button>
                    </span>
                  </div>
                  {detail ? (
                    <p className="mt-1 truncate font-mono text-xs text-zinc-600 dark:text-zinc-400">{detail}</p>
                  ) : null}
                  {selectors.length > 0 ? (
                    <p className="mt-1 truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">
                      {selectors[0].kind}: {selectors[0].value}
                      {selectors.length > 1 ? ` (+${selectors.length - 1} fallback)` : ""}
                    </p>
                  ) : null}
                  {step.type === "extractStructured" ? (
                    <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-zinc-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                      {fieldLines(step.root).join("\n")}
                    </pre>
                  ) : null}
                  {step.type === "fill" && step.value.mode === "literal" ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <form action={convertFillToPayloadAction.bind(null, automationId, step.id)}>
                        <button type="submit" className={smallButton}>
                          Add to payload
                        </button>
                      </form>
                      <form action={convertFillToCredentialAction.bind(null, automationId, step.id)}>
                        <button type="submit" className={smallButton}>
                          Add to credential
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
