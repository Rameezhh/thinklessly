"use client";

import { useActionState, useState } from "react";
import { importAutomationAction, type ImportAutomationState } from "@/lib/automation-actions";

type Example = { label: string; name: string; json: string };

const initialState: ImportAutomationState = {};

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-800";

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
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Load example
        </span>
        {examples.map((example) => (
          <button
            key={example.label}
            type="button"
            onClick={() => loadExample(example)}
            className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {example.label}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
        <label htmlFor="definitionJson" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
          className={`${inputClass} font-mono text-xs leading-relaxed`}
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="whitespace-pre-line rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Importing..." : "Import automation"}
        </button>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Importing publishes version 1 so it can run immediately.
        </p>
      </div>
    </form>
  );
}
