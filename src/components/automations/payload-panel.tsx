"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import type { Field, Step } from "@shared/definition";
import { fieldsUsedBySteps } from "@shared/fields";
import {
  deleteFieldAction,
  savePayloadDefaultsAction,
  type FieldPanelState,
} from "@/lib/automation-field-actions";
import { CheckIcon, CopyIcon } from "@/components/brand/icons";
import { Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Label } from "@/components/ui/input";
import { FieldAddForm } from "./field-add-form";

const initialState: FieldPanelState = {};

function initialValues(fields: Field[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    if (field.secret) continue;
    if (field.type === "checkbox") {
      values[field.key] = field.defaultValue === true ? "true" : "false";
      continue;
    }
    values[field.key] = field.defaultValue === undefined ? "" : String(field.defaultValue);
  }
  return values;
}

function buildPayload(fields: Field[], values: Record<string, string>): { inputs: Record<string, unknown> } {
  const inputs: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.secret) continue;
    const raw = values[field.key] ?? "";
    if (field.type === "checkbox") {
      inputs[field.key] = raw === "true" || raw === "on";
      continue;
    }
    if (field.type === "number") {
      if (raw.trim() === "") {
        inputs[field.key] = "";
        continue;
      }
      const number = Number(raw);
      inputs[field.key] = Number.isFinite(number) ? number : raw;
      continue;
    }
    inputs[field.key] = raw;
  }
  return { inputs };
}

export function PayloadPanel({
  automationId,
  fields,
  steps,
}: {
  automationId: string;
  fields: Field[];
  steps: Step[];
}) {
  const [state, formAction, saving] = useActionState(
    savePayloadDefaultsAction.bind(null, automationId),
    initialState,
  );
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(fields));
  const [copied, setCopied] = useState<"json" | "curl" | null>(null);

  const used = new Set(fieldsUsedBySteps(steps));
  const editable = fields.filter((field) => !field.secret);
  const credentials = fields.filter((field) => field.secret);
  const payload = useMemo(() => buildPayload(fields, values), [fields, values]);
  const payloadJson = JSON.stringify(payload, null, 2);
  const endpoint = `/api/v1/automations/${automationId}/runs`;
  const curl = [
    `curl -X POST http://localhost:3000${endpoint} \\`,
    `  -H "Authorization: Bearer wtm_..." \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -H "Idempotency-Key: order-123" \\`,
    `  --data-binary @payload.json`,
  ].join("\n");

  function update(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setCopied(null);
  }

  async function copy(value: string, kind: "json" | "curl") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle>Payload</CardTitle>
          <CardDescription>
            Every recorded input is included automatically. Recorded values become optional defaults;
            supplied values always win.
          </CardDescription>
        </div>
        <button
          type="button"
          onClick={() => void copy(payloadJson, "json")}
          className="btn btn-outline btn-sm"
        >
          {copied === "json" ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
          {copied === "json" ? "Copied" : "Copy JSON"}
        </button>
      </CardHeader>

      <CardBody className="space-y-5">
        {editable.length === 0 ? (
          <div className="rounded-2xl border-[1.5px] border-dashed border-[#D8D6CE] px-5 py-5 text-sm text-[#5C6070]">
            <p>No payload fields yet. Record an input or add a field below.</p>
            {credentials.length > 0 ? (
              <p className="mt-1">
                All current fields are credentials: {credentials.map((field) => field.key).join(", ")}.
              </p>
            ) : null}
          </div>
        ) : (
          <form action={formAction} className="space-y-5">
            <input type="hidden" name="values" value={JSON.stringify(values)} readOnly />

            <div className="grid gap-3 sm:grid-cols-2">
              {editable.map((field) => {
                const id = `payload-${field.key}`;
                const deletable = !used.has(field.key);
                const remove = (
                  <button
                    type="submit"
                    formAction={deleteFieldAction.bind(null, automationId, field.key)}
                    disabled={!deletable}
                    title={deletable ? "Delete field" : "This field is used by a step"}
                    className="rounded-lg p-1.5 text-[#8A8E9E] transition-colors hover:bg-[#FDE8E6] hover:text-[#B42318] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                );

                if (field.type === "checkbox") {
                  return (
                    <div
                      key={field.key}
                      className="flex items-center gap-2.5 rounded-xl border border-[#E5E4DE] bg-white px-3.5 py-2.5"
                    >
                      <Checkbox
                        id={id}
                        checked={values[field.key] === "true"}
                        onChange={(event) => update(field.key, event.target.checked ? "true" : "false")}
                      />
                      <label htmlFor={id} className="min-w-0 flex-1 text-sm text-[#14151A]">
                        {field.label}
                      </label>
                      <span className="mono text-[11px] text-[#5C6070]">{field.key}</span>
                      {remove}
                    </div>
                  );
                }

                return (
                  <div key={field.key} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor={id} className="text-[13px]">
                        {field.label}
                        {field.type === "file" ? (
                          <span className="mono ml-1 text-[10px] uppercase tracking-wide text-[#8A8E9E]">
                            path
                          </span>
                        ) : null}
                      </Label>
                      <div className="flex items-center gap-1">
                        <span className="mono text-[11px] text-[#5C6070]">{field.key}</span>
                        {remove}
                      </div>
                    </div>
                    <Input
                      id={id}
                      type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
                      value={values[field.key] ?? ""}
                      onChange={(event) => update(field.key, event.target.value)}
                      placeholder={
                        field.type === "number" ? "0" : field.type === "file" ? "/path/to/file" : ""
                      }
                      className="field-sm"
                    />
                  </div>
                );
              })}
            </div>

            {credentials.length > 0 ? (
              <p className="rounded-xl bg-[#FAFDEB] px-3.5 py-2.5 text-xs leading-relaxed text-[#3F5A00]">
                {credentials.length} credential(s) are attached automatically and never appear in this
                payload: {credentials.map((field) => field.key).join(", ")}.
              </p>
            ) : null}

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="mono text-[11px] uppercase tracking-[0.12em] text-[#5C6070]">
                  API request
                </p>
                <button
                  type="button"
                  onClick={() => void copy(curl, "curl")}
                  className="text-xs font-semibold text-[#14151A] underline underline-offset-2 transition-colors hover:text-[#3F5A00]"
                >
                  {copied === "curl" ? "Copied" : "Copy curl"}
                </button>
              </div>
              <pre className="code-block max-h-44 overflow-auto text-[11px]">{curl}</pre>
            </div>

            <div>
              <p className="mono mb-2 text-[11px] uppercase tracking-[0.12em] text-[#5C6070]">
                payload.json
              </p>
              <pre className="code-block max-h-56 overflow-auto text-[11px]">{payloadJson}</pre>
            </div>

            {state.error ? (
              <p
                role="alert"
                className="rounded-xl border border-[#F2C5C0] bg-[#FDE8E6] px-3.5 py-2.5 text-sm text-[#B42318]"
              >
                {state.error}
              </p>
            ) : null}
            {state.success ? (
              <p className="rounded-xl border border-[#CFE58A] bg-[#FAFDEB] px-3.5 py-2.5 text-sm text-[#3F5A00]">
                {state.success}
              </p>
            ) : null}

            <button type="submit" disabled={saving} className="btn btn-dark">
              {saving ? "Saving..." : "Save payload defaults"}
            </button>
          </form>
        )}

        <FieldAddForm automationId={automationId} kind="payload" />
      </CardBody>

      <CardFooter>
        <p>Values supplied by the API or a manual run override the defaults.</p>
        <span className="mono font-medium text-[#8A8E9E]">{editable.length} field(s)</span>
      </CardFooter>
    </Card>
  );
}