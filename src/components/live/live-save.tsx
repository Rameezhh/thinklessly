"use client";

import { useActionState } from "react";
import { importAutomationAction, type ImportAutomationState } from "@/lib/automation-actions";

const initialState: ImportAutomationState = {};

const primaryButton =
  "rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

const secondaryButton =
  "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900";

export function LiveSaveForm({
  name,
  definitionJson,
  issueCount,
  canSave,
  onStartOver,
}: {
  name: string;
  definitionJson: string;
  issueCount: number;
  canSave: boolean;
  onStartOver: () => void;
}) {
  const [state, formAction, saving] = useActionState(importAutomationAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="definitionJson" value={definitionJson} />
      {state.error ? (
        <p
          role="alert"
          className="whitespace-pre-line rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {state.error}
        </p>
      ) : null}
      {issueCount > 0 ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          Fix the JSON key issue above before saving.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving || !canSave || issueCount > 0} className={primaryButton}>
          {saving ? "Saving..." : "Save automation"}
        </button>
        <button type="button" onClick={onStartOver} disabled={saving} className={secondaryButton}>
          Start over
        </button>
      </div>
    </form>
  );
}