"use client";

import { useState, useTransition } from "react";
import type { AutomationDefinition, ExtractField, Step } from "@shared/definition";
import { DownIcon, UpIcon } from "@/components/brand/icons";
import {
  convertFillToCredentialAction,
  convertFillToPayloadAction,
  reorderStepsAction,
  setFieldRequiredAction,
  setStepOptionalAction,
} from "@/lib/automation-field-actions";

const smallButton =
  "flex h-8 w-8 items-center justify-center rounded-lg border-[1.5px] border-[#D8D6CE] bg-white text-[#14151A] transition-colors hover:border-[#b9b6ad] hover:bg-[#FBFBF9] disabled:cursor-not-allowed disabled:border-[#E5E4DE] disabled:text-[#B5B8C2] disabled:hover:bg-white";

function stepDetail(step: Step): string | null {
  switch (step.type) {
    case "goto":
      return step.url;
    case "fill":
      return step.value.mode === "field" ? `field: ${step.value.key}` : step.value.text;
    case "select":
      return typeof step.value === "string"
        ? step.value
        : step.value.mode === "field"
          ? `field: ${step.value.key}`
          : step.value.text;
    case "check":
      return typeof step.checked === "boolean"
        ? step.checked
          ? "checked"
          : "unchecked"
        : `field: ${step.checked.key}`;
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
    <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-[#14151A]">
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
        className="h-4 w-4 rounded accent-[#0E0F13]"
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
    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#5C6070]">
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
        className="h-4 w-4 rounded accent-[#0E0F13]"
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
  const [order, setOrder] = useState<string[]>(() => definition.steps.map((step) => step.id));
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const stepsById = new Map(definition.steps.map((step) => [step.id, step]));
  const orderedSteps = order.map((id) => stepsById.get(id)).filter(Boolean) as Step[];

  function moveStep(dragId: string, targetId: string) {
    if (dragId === targetId) return;
    const next = order.filter((id) => id !== dragId);
    const targetIndex = next.indexOf(targetId);
    if (targetIndex < 0) return;
    next.splice(targetIndex, 0, dragId);
    setOrder(next);
    startTransition(() => {
      void reorderStepsAction(automationId, next);
    });
  }

  function moveOffset(stepId: string, delta: number) {
    const currentIndex = order.indexOf(stepId);
    if (currentIndex < 0) return;
    const next = [...order];
    const targetIndex = currentIndex + delta;
    if (targetIndex < 0 || targetIndex >= next.length) return;
    [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
    setOrder(next);
    startTransition(() => {
      void reorderStepsAction(automationId, next);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Inputs</h2>
          <p className="card-desc">
            Values are supplied at run time. Uncheck “Required” to make an input optional. Secrets are
            encrypted at rest and never shown again.
          </p>
        </div>
        {definition.fields.length === 0 ? (
          <div className="px-7 py-5 text-sm text-[#5C6070]">No inputs.</div>
        ) : (
          <div className="divide-y divide-[#EFEEE8]">
            {definition.fields.map((field) => (
              <div
                key={field.key}
                className="flex flex-wrap items-center justify-between gap-3 px-7 py-3.5"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{field.label}</div>
                  <div className="mono mt-0.5 text-[12px] text-[#5C6070]">
                    {field.key} · {field.type}
                    {field.secret ? " · secret" : ""}
                  </div>
                </div>
                <RequiredToggle
                  automationId={automationId}
                  fieldKey={field.key}
                  required={field.required}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Steps</h2>
          <p className="card-desc">
            {definition.steps.length} steps · start URL: {definition.startUrl}
          </p>
          <p className="mt-0.5 text-[14px] leading-[1.55] text-[#5C6070]">
            Uncheck “Important” on a step to skip it when its element is missing instead of failing
            the run.
          </p>
        </div>

        <ol>
          {orderedSteps.map((step, index) => {
            const selectors = selectorsFor(step);
            const detail = stepDetail(step);
            const extraction = step.type === "extract" || step.type === "extractStructured";
            return (
              <li
                key={step.id}
                draggable
                onDragStart={() => setDragging(step.id)}
                onDragEnd={() => {
                  setDragging(null);
                  setDragOverId(null);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverId(step.id);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragging) moveStep(dragging, step.id);
                  setDragging(null);
                  setDragOverId(null);
                }}
                className={`flex gap-4 px-7 py-[22px] transition-colors ${
                  index < orderedSteps.length - 1 ? "border-b border-[#EFEEE8]" : ""
                } ${
                  dragOverId === step.id
                    ? "bg-[#FAFDEB] ring-2 ring-inset ring-[#C8F23B]"
                    : "hover:bg-[#FBFBF9]"
                }`}
              >
                <span
                  className={`mono mt-0.5 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[13px] ${
                    extraction
                      ? "bg-[#C8F23B] font-semibold text-[#0E0F13]"
                      : "bg-[#0E0F13] text-[#C8F23B]"
                  }`}
                >
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={`mono rounded-md px-2 py-0.5 text-[12px] ${
                        extraction
                          ? "bg-[#EEF9C8] text-[#3F5A00]"
                          : "bg-[#F1F0EB] text-[#14151A]"
                      }`}
                    >
                      {step.type}
                    </span>
                    <span className="text-base font-semibold text-[#14151A]">
                      {step.label ?? step.id}
                    </span>
                    {!step.enabled ? (
                      <span className="text-xs text-[#5C6070]">disabled</span>
                    ) : null}
                    {step.optional ? (
                      <span className="text-xs text-[#5C6070]">optional</span>
                    ) : null}
                  </div>

                  {detail ? (
                    <p className="mono mt-2 break-all text-[12px] leading-[1.7] text-[#5C6070]">
                      {detail}
                    </p>
                  ) : null}
                  {selectors.length > 0 ? (
                    <p className="mono mt-1.5 truncate text-[12px] text-[#5C6070]">
                      {selectors[0].kind}: {selectors[0].value}
                      {selectors.length > 1 ? ` (+${selectors.length - 1} fallback)` : ""}
                    </p>
                  ) : null}
                  {step.type === "extractStructured" ? (
                    <pre className="code-block mt-3.5 max-h-96 overflow-auto text-[12px]">
                      {fieldLines(step.root).join("\n")}
                    </pre>
                  ) : null}
                  {step.type === "fill" && step.value.mode === "literal" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <form action={convertFillToPayloadAction.bind(null, automationId, step.id)}>
                        <button type="submit" className="btn btn-outline btn-xs">
                          Add to payload
                        </button>
                      </form>
                      <form action={convertFillToCredentialAction.bind(null, automationId, step.id)}>
                        <button type="submit" className="btn btn-outline btn-xs">
                          Add to credential
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <ImportantToggle
                    automationId={automationId}
                    stepId={step.id}
                    optional={step.optional}
                  />
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => moveOffset(step.id, -1)}
                      disabled={index === 0}
                      className={smallButton}
                      aria-label={`Move step ${index + 1} up`}
                    >
                      <UpIcon size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveOffset(step.id, 1)}
                      disabled={index === orderedSteps.length - 1}
                      className={smallButton}
                      aria-label={`Move step ${index + 1} down`}
                    >
                      <DownIcon size={14} />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}