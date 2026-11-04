"use client";

import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import type { Field, Step } from "@shared/definition";
import { fieldsUsedBySteps } from "@shared/fields";
import {
  deleteFieldAction,
  savePayloadDefaultsAction,
  type FieldPanelState,
} from "@/lib/automation-field-actions";
import { Button } from "@/components/ui/button";
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
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-indigo-500" aria-hidden />
            Payload
          </CardTitle>
          <CardDescription>
            Every recorded input is included automatically. Recorded values become optional defaults; supplied
            values always win.
          </CardDescription>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => void copy(payloadJson, "json")}>
          {copied === "json" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied === "json" ? "Copied" : "Copy JSON"}
        </Button>
      </CardHeader>

      <CardBody className="space-y-4">
        {editable.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            <p>No payload fields yet. Record an input or add a field below.</p>
            {credentials.length > 0 ? (
              <p className="mt-1">
                All current fields are credentials: {credentials.map((field) => field.key).join(", ")}.
              </p>
            ) : null}
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
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
                    className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-rose-950/50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                );

                if (field.type === "checkbox") {
                  return (
                    <div
                      key={field.key}
                      className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <Checkbox
                        id={id}
                        checked={values[field.key] === "true"}
                        onChange={(event) => update(field.key, event.target.checked ? "true" : "false")}
                      />
                      <label htmlFor={id} className="min-w-0 flex-1 text-sm text-zinc-700 dark:text-zinc-300">
                        {field.label}
                      </label>
                      <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{field.key}</span>
                      {remove}
                    </div>
                  );
                }

                return (
                  <div key={field.key} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor={id}>
                        {field.label}
                        {field.type === "file" ? (
                          <span className="ml-1 text-[10px] uppercase tracking-wide text-zinc-400">path</span>
                        ) : null}
                      </Label>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                          {field.key}
                        </span>
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
                    />
                  </div>
                );
              })}
            </div>

            {credentials.length > 0 ? (
              <p className="rounded-xl bg-indigo-50/70 px-3 py-2 text-xs text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
                {credentials.length} credential(s) are attached automatically and never appear in this payload:{" "}
                {credentials.map((field) => field.key).join(", ")}.
              </p>
            ) : null}

            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                  API request
                </p>
                <button
                  type="button"
                  onClick={() => void copy(curl, "curl")}
                  className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-400"
                >
                  {copied === "curl" ? "Copied" : "Copy curl"}
                </button>
              </div>
              <pre className="max-h-44 overflow-auto rounded-xl bg-zinc-950 p-4 font-mono text-[11px] leading-relaxed text-zinc-100 ring-1 ring-white/5 dark:bg-black">
                {curl}
              </pre>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                payload.json
              </p>
              <pre className="max-h-56 overflow-auto rounded-xl bg-zinc-950 p-4 font-mono text-[11px] leading-relaxed text-zinc-100 ring-1 ring-white/5 dark:bg-black">
                {payloadJson}
              </pre>
            </div>

            {state.error ? (
              <p
                role="alert"
                className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
              >
                {state.error}
              </p>
            ) : null}
            {state.success ? (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                {state.success}
              </p>
            ) : null}

            <Button type="submit" loading={saving}>
              {saving ? "Saving..." : "Save payload defaults"}
            </Button>
          </form>
        )}

        <FieldAddForm automationId={automationId} kind="payload" />
      </CardBody>

      <CardFooter className="justify-between gap-2">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Values supplied by the API or a manual run override the defaults.
        </p>
        <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">{editable.length} field(s)</span>
      </CardFooter>
    </Card>
  );
}
