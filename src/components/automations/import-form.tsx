"use client";

import { useActionState, useState } from "react";
import { importAutomationAction, type ImportAutomationState } from "@/lib/automation-actions";

type Example = { label: string; name: string; json: string };

const initialState: ImportAutomationState = {};

const inputClass = "field";

export function ImportForm({ examples }: { examples: Example[] }) {
  const [state, formAction, pending] = useActionState(importAutomationAction, initialState);
  const [name, setName] = useState("");
  const [definitionJson, setDefinitionJson] = useState("");

  function loadExample(example: Example) {
    setName(example.name);
    setDefinitionJson(example.json);
  }

  return (
    <form action={formAction} className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono text-[11px] uppercase tracking-[0.12em] text-[#5C6070]">
          Load example
        </span>
        {examples.map((example) => (
          <button
            key={example.label}
            type="button"
            onClick={() => loadExample(example)}
            className="btn btn-outline btn-xs"
          >
            {example.label}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="name" className="label">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="My automation"
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="definitionJson" className="label">
          Definition JSON
        </label>
        <textarea
          id="definitionJson"
          name="definitionJson"
          required
          rows={22}
          spellCheck={false}
          value={definitionJson}
          onChange={(event) => setDefinitionJson(event.target.value)}
          placeholder={'{\n  "version": 1,\n  "startUrl": "https://example.com",\n  "steps": []\n}'}
          className={`${inputClass} mono`}
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="whitespace-pre-line rounded-xl border border-[#F2C5C0] bg-[#FDE8E6] px-4 py-3 text-sm text-[#B42318]"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-dark"
        >
          {pending ? "Importing..." : "Import automation"}
        </button>
        <p className="text-xs text-[#5C6070]">
          Importing publishes version 1 so it can run immediately.
        </p>
      </div>
    </form>
  );
}
