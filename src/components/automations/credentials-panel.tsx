"use client";

import { KeyRound, Lock, ShieldCheck, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
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
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-indigo-500" aria-hidden />
            Credentials
          </CardTitle>
          <CardDescription>
            Encrypted values attached to every run. They are never returned by the API and never accepted in an
            API payload.
          </CardDescription>
        </div>
        <Badge tone="neutral" icon={ShieldCheck}>
          {secretFields.length} credential(s)
        </Badge>
      </CardHeader>

      <CardBody className="space-y-4">
        {secretFields.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No credentials yet. Add one below, or convert a recorded password input.
          </p>
        ) : (
          <form action={formAction} className="space-y-3">
            {secretFields.map((field) => {
              const deletable = !used.has(field.key) && !saved.has(field.key);
              return (
                <div
                  key={field.key}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <KeyRound className="h-3.5 w-3.5 text-indigo-500" aria-hidden />
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{field.label}</span>
                    <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{field.key}</span>
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
                          className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <button
                        type="submit"
                        formAction={deleteFieldAction.bind(null, automationId, field.key)}
                        disabled={!deletable}
                        title={deletable ? "Delete credential field" : "Remove the saved value first"}
                        className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-rose-950/50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1">
                    <Label htmlFor={`credential-${field.key}`}>
                      {saved.has(field.key) ? "Replace value" : "Value"}
                    </Label>
                    <Input
                      id={`credential-${field.key}`}
                      type="password"
                      name={`credential:${field.key}`}
                      autoComplete="new-password"
                      placeholder={saved.has(field.key) ? "Leave blank to keep the saved value" : "Enter credential"}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              );
            })}

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
              {saving ? "Saving..." : "Save credentials"}
            </Button>
          </form>
        )}

        <FieldAddForm automationId={automationId} kind="credential" />

        {movableFields.length > 0 ? (
          <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
              Move a payload field to credentials
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              The default value is removed from the definition and must be entered here instead.
            </p>
            <ul className="mt-2 space-y-1.5">
              {movableFields.map((field) => (
                <li
                  key={field.key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
                >
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{field.key}</span> ·{" "}
                    {field.label}
                  </span>
                  <form action={moveFieldToCredentialsAction.bind(null, automationId, field.key)}>
                    <Button type="submit" variant="secondary" size="sm">
                      Move to credentials
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardBody>

      <CardFooter>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Passwords recorded in the browser are created as credentials automatically.
        </p>
      </CardFooter>
    </Card>
  );
}
