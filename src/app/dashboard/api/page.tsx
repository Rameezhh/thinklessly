import type { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@shared/db";
import { ApiKeysPanel, type ApiKeyRow } from "@/components/api/api-keys-panel";
import { QuickStart } from "@/components/api/quick-start";
import { WebhookPanel } from "@/components/api/webhook-panel";
import { PageLoading } from "@/components/dashboard/page-loading";
import { formatDateTime } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "API",
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

  const baseUrl = process.env.APP_BASE_URL ?? `http://localhost:${process.env.PORT ?? "3000"}`;

  return (
    <div className="max-w-[880px]">
      <h1 className="display text-[34px] leading-[1.05] tracking-[-0.035em] sm:text-[44px]">API</h1>
      <p className="mt-2.5 text-base leading-[1.55] text-[#5C6070]">
        Run automations from any script with an API key. Secrets are encrypted in transit and storage
        and never returned.
      </p>

      <div className="mt-9 space-y-6">
        <ApiKeysPanel keys={rows} />
        <WebhookPanel
          initialUrl={team?.webhookUrl ?? ""}
          hasSecret={Boolean(team?.webhookSecretCipher)}
        />

        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Quick start</h2>
            <p className="card-desc">
              Replace the automation id and API key. Add{" "}
              <code className="mono rounded-md bg-[#F1F0EB] px-1.5 py-0.5 text-[12px]">?wait=30</code>{" "}
              to wait for completion.
            </p>
          </div>
          <QuickStart baseUrl={baseUrl} />
        </section>
      </div>
    </div>
  );
}