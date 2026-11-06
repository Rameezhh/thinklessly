"use client";

import { useActionState, useState } from "react";
import {
  rotateWebhookSecretAction,
  saveWebhookAction,
  type WebhookFormState,
} from "@/lib/webhook-actions";

const initialState: WebhookFormState = {};

const inputClass = "field";

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
    <section className="card">
      <div className="border-b border-b border-[#E5E4DE] px-7 py-6">
        <h2 className="card-title">Webhook</h2>
        <p className="mt-1 card-desc">
          We send a POST when a run finishes. Verify the <code className="mono rounded-md bg-[#F1F0EB] px-1.5 py-0.5 text-[12px]">X-Thinklessly-Signature</code> header with
          HMAC-SHA256 using your signing secret.
        </p>
      </div>

      <form action={saveAction} className="space-y-3 px-7 py-6">
        <div className="space-y-1.5">
          <label htmlFor="webhook-url" className="label">
            Endpoint URL
          </label>
          <input
            id="webhook-url"
            name="webhookUrl"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="http://localhost:4000/hooks/thinklessly"
            className={inputClass + " mono"}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="btn btn-dark"
          >
            {saving ? "Saving..." : "Save webhook"}
          </button>
          <span className="card-desc">
            {hasSecret || secret ? "Signing secret configured" : "A signing secret is created when you save a URL"}
          </span>
        </div>
        {saveState.error ? (
          <p role="alert" className="text-sm text-[#B42318]">
            {saveState.error}
          </p>
        ) : saveState.saved ? (
          <p className="text-sm text-[#0B6B43]">Saved.</p>
        ) : null}
      </form>

      <form action={rotateAction} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E4DE] px-7 py-5">
        <span className="text-sm text-[#5C6070]">Replace the secret if you think it has leaked.</span>
        <button
          type="submit"
          disabled={rotating}
          className="btn btn-outline btn-sm"
        >
          {rotating ? "Rotating..." : "Rotate signing secret"}
        </button>
        {rotateState.error ? (
          <p role="alert" className="w-full text-sm text-[#B42318]">
            {rotateState.error}
          </p>
        ) : null}
      </form>

      {secret ? (
        <div className="border-t border-emerald-200 bg-[#FAFDEB] px-7 py-4">
          <p className="text-sm font-medium text-[#0B6B43]">
            Copy this signing secret now. It will not be shown again.
          </p>
          <code className="mono mt-2 block break-all rounded-xl border border-[#CFE58A] bg-white px-3 py-2 text-xs text-[#0B6B43]">
            {secret}
          </code>
        </div>
      ) : null}
    </section>
  );
}
