"use client";

import { useActionState, useState } from "react";
import {
  createApiKeyAction,
  revokeApiKeyAction,
  type ApiKeyFormState,
} from "@/lib/api-key-actions";

export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

const initialState: ApiKeyFormState = {};

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-800";

export function ApiKeysPanel({ keys }: { keys: ApiKeyRow[] }) {
  const [state, formAction, pending] = useActionState(createApiKeyAction, initialState);
  const [name, setName] = useState("");

  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">API keys</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Keys are hashed. The full key is shown once, so copy it before leaving this page.
        </p>
      </div>

      <form action={formAction} className="flex flex-wrap items-end gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <div className="min-w-[220px] flex-1 space-y-1.5">
          <label htmlFor="api-key-name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Key name
          </label>
          <input
            id="api-key-name"
            name="name"
            type="text"
            required
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="CI server"
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Creating..." : "Create key"}
        </button>
      </form>

      {state.error ? (
        <p role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      ) : null}

      {state.key ? (
        <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-4 dark:border-emerald-900 dark:bg-emerald-950">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            Copy this key now. It will not be shown again.
          </p>
          <code className="mt-2 block break-all rounded bg-white px-3 py-2 font-mono text-xs text-emerald-900 dark:bg-black dark:text-emerald-300">
            {state.key}
          </code>
        </div>
      ) : null}

      {keys.length === 0 ? (
        <p className="px-5 py-6 text-sm text-zinc-500 dark:text-zinc-400">No API keys yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {keys.map((key) => (
            <li key={key.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {key.name}
                  {key.revokedAt ? (
                    <span className="ml-2 text-xs font-normal text-red-600 dark:text-red-400">revoked</span>
                  ) : null}
                </p>
                <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{key.prefix}…</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  created {key.createdAt} · last used {key.lastUsedAt ?? "never"}
                </p>
              </div>
              {!key.revokedAt ? (
                <form action={revokeApiKeyAction.bind(null, key.id)}>
                  <button
                    type="submit"
                    className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
                  >
                    Revoke
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
