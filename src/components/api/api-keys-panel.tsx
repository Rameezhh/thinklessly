"use client";

import { useActionState, useState } from "react";
import { KeyIcon } from "@/components/brand/icons";
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

const inputClass = "field";

export function ApiKeysPanel({ keys }: { keys: ApiKeyRow[] }) {
  const [state, formAction, pending] = useActionState(createApiKeyAction, initialState);
  const [name, setName] = useState("");

  return (
    <section className="card">
      <div className="border-b border-b border-[#E5E4DE] px-7 py-6">
        <h2 className="card-title">API keys</h2>
        <p className="mt-1 card-desc">
          Keys are hashed. The full key is shown once, so copy it before leaving this page.
        </p>
      </div>

      <form action={formAction} className="flex flex-wrap items-end gap-3 border-b border-b border-[#E5E4DE] px-7 py-6">
        <div className="min-w-[220px] flex-1 space-y-1.5">
          <label htmlFor="api-key-name" className="label">
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
          className="btn btn-dark"
        >
          {pending ? "Creating..." : "Create key"}
        </button>
      </form>

      {state.error ? (
        <p role="alert" className="border-b border-[#F2C5C0] bg-[#FDE8E6] px-7 py-3 text-sm text-[#B42318]">
          {state.error}
        </p>
      ) : null}

      {state.key ? (
        <div className="border-b border-emerald-200 bg-[#FAFDEB] px-7 py-4">
          <p className="text-sm font-medium text-[#0B6B43]">
            Copy this key now. It will not be shown again.
          </p>
          <code className="mt-2 block break-all mono mt-2 block break-all rounded-xl border border-[#CFE58A] bg-white px-3 py-2 text-xs text-[#0B6B43]">
            {state.key}
          </code>
        </div>
      ) : null}

      {keys.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 bg-[#FBFBF9] px-7 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#F1F0EB] text-[#14151A]">
            <KeyIcon size={22} />
          </div>
          <p className="text-base font-semibold text-[#14151A]">No API keys yet</p>
          <p className="max-w-[360px] text-sm leading-relaxed text-[#5C6070]">
            Create your first key above to start running automations from your own code.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[#EFEEE8]">
          {keys.map((key) => (
            <li key={key.id} className="flex flex-wrap items-center justify-between gap-3 px-7 py-4">
              <div>
                <p className="text-sm font-medium text-[#14151A]">
                  {key.name}
                  {key.revokedAt ? (
                    <span className="ml-2 text-xs font-normal text-[#B42318]">revoked</span>
                  ) : null}
                </p>
                <p className="font-mono card-desc">{key.prefix}…</p>
                <p className="card-desc">
                  created {key.createdAt} · last used {key.lastUsedAt ?? "never"}
                </p>
              </div>
              {!key.revokedAt ? (
                <form action={revokeApiKeyAction.bind(null, key.id)}>
                  <button
                    type="submit"
                    className="btn btn-danger btn-sm"
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
