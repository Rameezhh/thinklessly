import type { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@shared/db";
import { ApiKeysPanel, type ApiKeyRow } from "@/components/api/api-keys-panel";
import { WebhookPanel } from "@/components/api/webhook-panel";
import { PageLoading } from "@/components/dashboard/page-loading";
import { formatDateTime } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "API | Webtomate",
};

export default function ApiPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ApiContent />
    </Suspense>
  );
}

async function ApiContent() {
  const user = await requireUser();

  const [keys, team] = await Promise.all([
    prisma.apiKey.findMany({
      where: { teamId: user.teamId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.team.findUnique({
      where: { id: user.teamId },
      select: { webhookUrl: true, webhookSecretCipher: true },
    }),
  ]);

  const rows: ApiKeyRow[] = keys.map((key) => ({
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    createdAt: formatDateTime(key.createdAt),
    lastUsedAt: key.lastUsedAt ? formatDateTime(key.lastUsedAt) : null,
    revokedAt: key.revokedAt ? formatDateTime(key.revokedAt) : null,
  }));

  const baseUrl = `http://localhost:${process.env.PORT ?? "3000"}`;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">API</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Run automations from any script with an API key. Secrets are encrypted in transit storage and never
            returned.
          </p>
        </div>

        <ApiKeysPanel keys={rows} />
        <WebhookPanel initialUrl={team?.webhookUrl ?? ""} hasSecret={Boolean(team?.webhookSecretCipher)} />

        <section className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Quick start</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Replace the automation id and API key. Add <code>?wait=30</code> to wait for completion.
            </p>
          </div>
          <div className="space-y-4 px-5 py-4">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Start a run
              </p>
              <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-100 dark:bg-black">
{`curl -X POST ${baseUrl}/api/v1/automations/<automation-id>/runs \\
  -H "Authorization: Bearer wtm_..." \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: order-123" \\
  -d '{"inputs":{},"secrets":{}}'`}
              </pre>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Fetch a run and wait up to 30 seconds
              </p>
              <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-100 dark:bg-black">
{`curl -H "Authorization: Bearer wtm_..." \\
  "${baseUrl}/api/v1/runs/<run-id>?wait=30"`}
              </pre>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Cancel a run
              </p>
              <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-100 dark:bg-black">
{`curl -X POST -H "Authorization: Bearer wtm_..." \\
  ${baseUrl}/api/v1/runs/<run-id>/cancel`}
              </pre>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
