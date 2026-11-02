"use client";

import { useActionState, useState } from "react";
import {
  rotateWebhookSecretAction,
  saveWebhookAction,
  type WebhookFormState,
} from "@/lib/webhook-actions";

const initialState: WebhookFormState = {};

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-800";

export function WebhookPanel({
  initialUrl,
  hasSecret,
}: {
  initialUrl: string;
  hasSecret: boolean;
}) {
  const [saveState, saveAction, saving] = useActionState(saveWebhookAction, initialState);
  const [rotateState, rotateAction, rotating] = useActionState(rotateWebhookSecretAction, initialState);
  const [url, setUrl] = useState(initialUrl);
  const secret = saveState.secret ?? rotateState.secret;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Webhook</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          We send a POST when a run finishes. Verify the <code>X-Webtomate-Signature</code> header with
          HMAC-SHA256 using your signing secret.
        </p>
      </div>

      <form action={saveAction} className="space-y-3 px-5 py-4">
        <div className="space-y-1.5">
          <label htmlFor="webhook-url" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Endpoint URL
          </label>
          <input
            id="webhook-url"
            name="webhookUrl"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="http://localhost:4000/hooks/webtomate"
            className={inputClass}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {saving ? "Saving..." : "Save webhook"}
          </button>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {hasSecret || secret ? "Signing secret configured" : "A signing secret is created when you save a URL"}
          </span>
        </div>
        {saveState.error ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {saveState.error}
          </p>
        ) : saveState.saved ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">Saved.</p>
        ) : null}
      </form>

      <form action={rotateAction} className="border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <button
          type="submit"
          disabled={rotating}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {rotating ? "Rotating..." : "Rotate signing secret"}
        </button>
        {rotateState.error ? (
          <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
            {rotateState.error}
          </p>
        ) : null}
      </form>

      {secret ? (
        <div className="border-t border-emerald-200 bg-emerald-50 px-5 py-4 dark:border-emerald-900 dark:bg-emerald-950">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            Copy this signing secret now. It will not be shown again.
          </p>
          <code className="mt-2 block break-all rounded bg-white px-3 py-2 font-mono text-xs text-emerald-900 dark:bg-black dark:text-emerald-300">
            {secret}
          </code>
        </div>
      ) : null}
    </section>
  );
}
