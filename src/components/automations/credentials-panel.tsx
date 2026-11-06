"use client";

import { KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import { useActionState } from "react";
import type { Field, Step } from "@shared/definition";
import { fieldsUsedBySteps } from "@shared/fields";
import {
  deleteCredentialAction,
  deleteFieldAction,
  moveFieldToCredentialsAction,
  saveCredentialsAction,
  type FieldPanelState,
} from "@/lib/automation-field-actions";
import { Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { FieldAddForm } from "./field-add-form";

const initialState: FieldPanelState = {};

export function CredentialsPanel({
  automationId,
  fields,
  steps,
  savedSecretKeys,
}: {
  automationId: string;
  fields: Field[];
  steps: Step[];
  savedSecretKeys: string[];
}) {
  const [state, formAction, saving] = useActionState(
    saveCredentialsAction.bind(null, automationId),
    initialState,
  );
  const saved = new Set(savedSecretKeys);
  const used = new Set(fieldsUsedBySteps(steps));
  const secretFields = fields.filter((field) => field.secret);
  const movableFields = fields.filter((field) => !field.secret);

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle>Credentials</CardTitle>
          <CardDescription>
            Encrypted values attached to every run. They are never returned by the API and never
            accepted in an API payload.
          </CardDescription>
        </div>
        <Badge tone="neutral" icon={ShieldCheck}>
          {secretFields.length} credential(s)
        </Badge>
      </CardHeader>

      <CardBody className="space-y-5">
        {secretFields.length === 0 ? (
          <p className="rounded-2xl border-[1.5px] border-dashed border-[#D8D6CE] px-5 py-5 text-sm text-[#5C6070]">
            No credentials yet. Add one below, or convert a recorded password input.
          </p>
        ) : (
          <form action={formAction} className="space-y-3">
            {secretFields.map((field) => {
              const deletable = !used.has(field.key) && !saved.has(field.key);
              return (
                <div
                  key={field.key}
                  className="rounded-2xl border border-[#E5E4DE] bg-white px-4 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <KeyRound className="h-3.5 w-3.5 text-[#5C6070]" aria-hidden />
                    <span className="text-sm font-semibold text-[#14151A]">{field.label}</span>
                    <span className="mono text-xs text-[#5C6070]">{field.key}</span>
                    {saved.has(field.key) ? (
                      <Badge tone="success">saved</Badge>
                    ) : (
                      <Badge tone="warning">not set</Badge>
                    )}
                    <div className="ml-auto flex items-center gap-1">
                      {saved.has(field.key) ? (
                        <button
                          type="submit"
                          formAction={deleteCredentialAction.bind(null, automationId, field.key)}
                          title="Delete saved value"
                          className="rounded-lg p-1.5 text-[#8A8E9E] transition-colors hover:bg-[#FDE8E6] hover:text-[#B42318]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <button
                        type="submit"
                        formAction={deleteFieldAction.bind(null, automationId, field.key)}
                        disabled={!deletable}
                        title={deletable ? "Delete credential field" : "Remove the saved value first"}
                        className="rounded-lg p-1.5 text-[#8A8E9E] transition-colors hover:bg-[#FDE8E6] hover:text-[#B42318] disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2.5 space-y-1.5">
                    <Label htmlFor={`credential-${field.key}`} className="text-[13px]">
                      {saved.has(field.key) ? "Replace value" : "Value"}
                    </Label>
                    <Input
                      id={`credential-${field.key}`}
                      type="password"
                      name={`credential:${field.key}`}
                      autoComplete="new-password"
                      placeholder={saved.has(field.key) ? "Leave blank to keep the saved value" : "Enter credential"}
                      className="field-sm"
                    />
                  </div>
                </div>
              );
            })}

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
              {saving ? "Saving..." : "Save credentials"}
            </button>
          </form>
        )}

        <FieldAddForm automationId={automationId} kind="credential" />

        {movableFields.length > 0 ? (
          <div className="border-t border-[#E5E4DE] pt-4">
            <p className="mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5C6070]">
              Move a payload field to credentials
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-[#5C6070]">
              The default value is removed from the definition and must be entered here instead.
            </p>
            <ul className="mt-3 space-y-2">
              {movableFields.map((field) => (
                <li
                  key={field.key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E5E4DE] px-3.5 py-2.5"
                >
                  <span className="text-sm text-[#14151A]">
                    <span className="mono text-xs text-[#5C6070]">{field.key}</span> · {field.label}
                  </span>
                  <form action={moveFieldToCredentialsAction.bind(null, automationId, field.key)}>
                    <button type="submit" className="btn btn-outline btn-xs">
                      Move to credentials
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardBody>

      <CardFooter>
        <p>Passwords recorded in the browser are created as credentials automatically.</p>
      </CardFooter>
    </Card>
  );
}