import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { fromJson } from "@shared/json";
import { PageLoading } from "@/components/dashboard/page-loading";
import { RunRefresher } from "@/components/runs/run-refresher";
import { formatDateTime, isActiveStatus, statusClasses } from "@/lib/format";
import { findRun } from "@/lib/ownership";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Run | Webtomate",
};

const levelClasses: Record<string, string> = {
  info: "text-zinc-600 dark:text-zinc-400",
  warn: "text-amber-700 dark:text-amber-300",
  error: "text-red-700 dark:text-red-300",
};

export default function RunPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <RunContent params={params} />
    </Suspense>
  );
}

async function RunContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const run = await findRun(user.teamId, id);
  if (!run) notFound();

  const active = isActiveStatus(run.status);
  const outputs = fromJson<Record<string, unknown>>(run.outputs ?? "{}", {});
  const screenshots = run.artifacts.filter((artifact) => artifact.kind === "SCREENSHOT");
  const otherArtifacts = run.artifacts.filter((artifact) => artifact.kind !== "SCREENSHOT");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <RunRefresher active={active} />
      <div className="space-y-6">
        <div>
          <Link
            href={`/dashboard/automations/${run.automation.id}`}
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← {run.automation.name}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Run {run.id.slice(-8)}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusClasses(run.status)}`}
            >
              {run.status}
            </span>
            {active ? <span className="text-xs text-zinc-500 dark:text-zinc-400">Refreshing automatically…</span> : null}
          </div>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {run.triggerSource} · queued {formatDateTime(run.createdAt)} · started {formatDateTime(run.startedAt)} · finished{" "}
            {formatDateTime(run.finishedAt)}
          </p>
        </div>

        {run.status === "QUEUED" ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            Queued. The worker picks up new runs within about one second.
          </p>
        ) : null}

        {run.status === "NEEDS_HUMAN" ? (
          <p className="rounded-md border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-800 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300">
            This run is waiting for human help. Live help is added in a later phase; the failed step is recorded below.
          </p>
        ) : null}

        {run.error ? (
          <p
            role="alert"
            className="whitespace-pre-line rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            {run.error}
          </p>
        ) : null}

        <section className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Logs</h2>
          </div>
          {run.logs.length === 0 ? (
            <p className="px-5 py-6 text-sm text-zinc-500 dark:text-zinc-400">
              {active ? "Waiting for the worker..." : "No logs."}
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 font-mono text-xs dark:divide-zinc-900">
              {run.logs.map((log) => (
                <li key={log.id} className="flex gap-3 px-5 py-2">
                  <span className="shrink-0 text-zinc-400 dark:text-zinc-500">{formatDateTime(log.createdAt)}</span>
                  <span className={`w-10 shrink-0 uppercase ${levelClasses[log.level] ?? levelClasses.info}`}>
                    {log.level}
                  </span>
                  <span className="min-w-0 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                    {log.stepId ? `[${log.stepId}] ` : ""}
                    {log.message}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Outputs</h2>
          </div>
          <pre className="overflow-x-auto px-5 py-4 font-mono text-xs text-zinc-700 dark:text-zinc-300">
            {JSON.stringify(outputs, null, 2)}
          </pre>
        </section>

        {screenshots.length > 0 || otherArtifacts.length > 0 ? (
          <section className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Artifacts</h2>
            </div>
            <div className="space-y-4 px-5 py-4">
              {screenshots.map((artifact) => (
                <a
                  key={artifact.id}
                  href={`/api/artifacts/${artifact.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800"
                >
                  <Image
                    src={`/api/artifacts/${artifact.id}`}
                    alt={`Screenshot from run ${run.id}`}
                    width={1200}
                    height={800}
                    unoptimized
                    className="h-auto w-full"
                  />
                </a>
              ))}
              {otherArtifacts.map((artifact) => (
                <a
                  key={artifact.id}
                  href={`/api/artifacts/${artifact.id}`}
                  className="block text-sm font-medium text-zinc-700 underline dark:text-zinc-300"
                >
                  Download {artifact.kind.toLowerCase()} artifact
                </a>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
