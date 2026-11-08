"use client";

import { outputKeySchema, stepCriticality, type ExtractField, type Field, type Step } from "@shared/definition";
import { outputIssuesForSteps } from "@shared/outputs";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExtractionTreeEditor } from "./extraction-tree-editor";

type Props = {
  steps: Step[];
  fields: Field[];
  previews: Record<string, unknown>;
  previewTotals?: Record<string, number>;
  editable: boolean;
  onChange: (steps: Step[]) => void;
};

const inputClass = "field field-sm";

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
  if (step.type === "extractApi") return `${step.request.method} ${step.match.pathname} → ${step.outputKey}`;
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
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (key: string) => void;
}) {
  const valid = outputKeySchema.safeParse(value).success;
  return (
    <label className="mt-2 flex max-w-sm flex-col gap-1">
      <span className="mono text-[11px] uppercase tracking-[0.06em] text-[#5C6070]">
        Output / JSON key
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        spellCheck={false}
        className={`${inputClass} ${valid ? "" : "!border-[#B42318]"}`}
      />
    </label>
  );
}

export function RecorderReview({ steps, fields, previews, previewTotals, editable, onChange }: Props) {
  const issues = outputIssuesForSteps(steps);

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>{editable ? "2. Review and save" : "Recorded steps"}</CardTitle>
          <CardDescription>
            {editable
              ? "Rename JSON keys before saving. Captured values stay live and are read again on every run."
              : "Steps and data fields appear here as you work in the browser."}
          </CardDescription>
        </div>
        <span className="text-xs text-[#5C6070]">{steps.length} steps</span>
      </CardHeader>

      <CardBody>
        {issues.length > 0 ? (
          <p
            role="alert"
            className="mb-3 rounded-xl border border-[#F2C5C0] bg-[#FDE8E6] px-3 py-2 text-sm text-[#B42318]"
          >
            {issues[0]?.message}
            {issues.length > 1 ? ` (+${issues.length - 1} more)` : ""}
          </p>
        ) : null}

        {steps.length === 0 ? (
          <p className="text-sm text-[#5C6070]">
            Interact with the browser window. Steps will appear here as you work.
          </p>
        ) : (
        <ol className="max-h-[36rem] space-y-2 overflow-auto pr-1">
          {steps.map((step, index) => {
            const preview =
              step.type === "extractStructured" || step.type === "extractApi" ? previews[step.id] : undefined;
            const previewTotal =
              step.type === "extractStructured" || step.type === "extractApi" ? previewTotals?.[step.id] : undefined;
            const itemCount =
              previewTotal ?? (Array.isArray(preview) ? preview.length : undefined);
            return (
              <li
                key={step.id}
                className="rounded-2xl border border-[#E5E4DE] px-4 py-3 text-sm hover:border-[#C3C0B7] transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="mono mt-0.5 w-6 shrink-0 text-right text-xs text-[#8A8E9E]">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 break-words font-semibold text-[#14151A]">
                        {step.label ?? step.type}
                      </span>
                      <span className="mono rounded-md bg-[#F1F0EB] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-[#5C6070]">
                        {step.type === "extractStructured"
                          ? "data"
                          : step.type === "extractApi"
                            ? "api"
                            : step.type}
                      </span>
                      {!step.enabled ? (
                        <span className="text-xs text-[#5C6070]">disabled</span>
                      ) : null}
                      {stepCriticality(step) !== "required" ? (
                        <span className="text-xs text-[#5C6070]">{stepCriticality(step)}</span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-[#5C6070]">
                      {stepDetail(step)}
                    </p>

                    {step.type === "extract" ? (
                      <SingleKeyEditor
                        value={step.outputKey}
                        disabled={!editable}
                        onChange={(key) => onChange(updateStep(steps, index, { ...step, outputKey: key }))}
                      />
                    ) : null}

                    {step.type === "extractApi" ? (
                      <div className="mt-3 rounded-2xl border border-[#E5E4DE] bg-[#FBFBF9] px-4 py-3">
                        <p className="mono text-[11px] text-[#5C6070]">
                          {step.request.method} {step.match.pathname} · {step.shape} ·{" "}
                          {step.fields.length} field(s)
                        </p>
                        {step.fields.length > 0 ? (
                          <p className="mono mt-1 break-words text-[11px] text-[#5C6070]">
                            {step.fields
                              .slice(0, 20)
                              .map((field) => `${field.key} ← ${field.path.join(".") || field.label || "item"}`)
                              .join(" · ")}
                          </p>
                        ) : null}
                        {step.outputSchema && step.outputSchema.fields.length > 0 ? (
                          <p className="mono mt-1 break-words text-[11px] text-[#3F5A00]">
                            Canonical schema:{" "}
                            {step.outputSchema.fields
                              .slice(0, 20)
                              .map((field) => `${field.key}:${field.type}`)
                              .join(", ")}
                          </p>
                        ) : null}
                        <SingleKeyEditor
                          value={step.outputKey}
                          disabled={!editable}
                          onChange={(key) => onChange(updateStep(steps, index, { ...step, outputKey: key }))}
                        />
                        {preview !== undefined ? (
                          <details className="mt-2 rounded-2xl border border-[#E5E4DE] bg-white px-4 py-3">
                            <summary className="cursor-pointer text-xs font-medium text-[#5C6070]">
                              Sample JSON from the API
                              {itemCount !== undefined ? ` (${itemCount} item${itemCount === 1 ? "" : "s"})` : ""}
                            </summary>
                            <pre className="code-block mt-2 max-h-[28rem] overflow-auto text-[11px] text-[#D5D8E2]">
                              {JSON.stringify(preview, null, 2)}
                            </pre>
                            <p className="mt-2 text-[11px] text-[#5C6070]">
                              Each run reads this endpoint again and maps it onto the canonical schema above, so
                              renamed keys still come back in the same shape.
                            </p>
                          </details>
                        ) : null}
                      </div>
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
                          <details className="mt-2 rounded-2xl border border-[#E5E4DE] bg-[#FBFBF9] px-4 py-3">
                            <summary className="cursor-pointer text-xs font-medium text-[#5C6070]">
                              Sample JSON from the page
                              {itemCount !== undefined ? ` (${itemCount} item${itemCount === 1 ? "" : "s"})` : ""}
                            </summary>
                            <pre className="code-block mt-2 max-h-[28rem] overflow-auto text-[11px] text-[#D5D8E2]">
                              {JSON.stringify(preview, null, 2)}
                            </pre>
                            <p className="mt-2 text-[11px] text-[#5C6070]">
                              This is the full data captured for this step. Each run reads it fresh from the page.
                            </p>
                          </details>
                        ) : editable ? (
                          <p className="mt-2 text-xs text-[#5C6070]">
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
        <div className="mt-4 rounded-2xl border border-[#E5E4DE] bg-[#FBFBF9] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[#5C6070]">
            Run-time inputs
          </p>
          <ul className="mt-2 space-y-1">
            {fields.map((field) => (
              <li key={field.key} className="text-sm text-[#14151A]">
                <span className="font-mono text-xs">{field.key}</span> · {field.label} · {field.type}
                {field.secret ? " · secret" : ""}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[#5C6070]">
            Password and file values are never recorded. You will enter them when running the automation.
          </p>
        </div>
      ) : null}
      </CardBody>
    </Card>
  );
}
