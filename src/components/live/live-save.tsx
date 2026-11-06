"use client";

import { useActionState } from "react";
import { importAutomationAction, type ImportAutomationState } from "@/lib/automation-actions";

const initialState: ImportAutomationState = {};

const primaryButton = "btn btn-dark";

const secondaryButton = "btn btn-outline";

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
          className="whitespace-pre-line rounded-xl border border-[#F2C5C0] bg-[#FDE8E6] px-4 py-3 text-sm text-[#B42318]"
        >
          {state.error}
        </p>
      ) : null}
      {issueCount > 0 ? (
        <p className="rounded-xl border border-[#CFE58A] bg-[#FAFDEB] px-4 py-3 text-sm text-[#3F5A00]">
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