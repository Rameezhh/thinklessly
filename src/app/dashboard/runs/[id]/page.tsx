import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { fromJson } from "@shared/json";
import { ArrowLeftIcon } from "@/components/brand/icons";
import { PageLoading } from "@/components/dashboard/page-loading";
import { RunRefresher } from "@/components/runs/run-refresher";
import { StatusPill } from "@/components/ui/status-pill";
import { formatDateTime, isActiveStatus } from "@/lib/format";
import { findRun } from "@/lib/ownership";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Run",
};

const levelClasses: Record<string, string> = {
  info: "text-[#5C6070]",
  warn: "text-[#B45309]",
  error: "text-[#B42318]",
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
    <div>
      <RunRefresher active={active} />
      <Link
        href={`/dashboard/automations/${run.automation.id}`}
        className="link-arrow inline-flex items-center gap-2 text-[14px] font-semibold text-[#5C6070] transition-colors hover:text-[#14151A]"
      >
        <ArrowLeftIcon size={14} />
        {run.automation.name}
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="display text-[34px] leading-[1.05] tracking-[-0.035em] sm:text-[44px]">
          Run {run.id.slice(-8)}
        </h1>
        <StatusPill status={run.status} />
        {active ? (
          <span className="animate-pulse mono text-[12px] text-[#5C6070]">
            Refreshing automatically…
          </span>
        ) : null}
      </div>
      <p className="mono mt-1.5 text-[13px] text-[#5C6070]">
        {run.triggerSource.toUpperCase()} · queued {formatDateTime(run.createdAt)} · started{" "}
        {formatDateTime(run.startedAt)} · finished {formatDateTime(run.finishedAt)}
      </p>

      {run.status === "QUEUED" ? (
        <p className="mt-6 rounded-2xl border-[1.5px] border-dashed border-[#D8D6CE] bg-[#FBFBF9] px-4 py-3.5 text-sm text-[#5C6070]">
          Queued. The worker picks up new runs within about one second.
        </p>
      ) : null}

      {run.status === "NEEDS_HUMAN" ? (
        <p className="mt-6 rounded-2xl border border-[#2A2D38] bg-[#0E0F13] px-4 py-3.5 text-sm text-[#D5D8E2]">
          This run is waiting for human help. The failed step is recorded below.
        </p>
      ) : null}

      {run.error ? (
        <p
          role="alert"
          className="mt-6 whitespace-pre-line rounded-2xl border border-[#F2C5C0] bg-[#FDE8E6] px-4 py-3.5 text-sm text-[#B42318]"
        >
          {run.error}
        </p>
      ) : null}

      <section className="card mt-6">
        <div className="card-head">
          <h2 className="card-title">Logs</h2>
        </div>
        {run.logs.length === 0 ? (
          <p className="px-7 py-6 text-sm text-[#5C6070]">
            {active ? "Waiting for the worker..." : "No logs."}
          </p>
        ) : (
          <ul className="mono divide-y divide-[#EFEEE8] text-[12px]">
            {run.logs.map((log) => (
              <li key={log.id} className="flex flex-wrap gap-3 px-7 py-2.5">
                <span className="shrink-0 text-[#8A8E9E]">{formatDateTime(log.createdAt)}</span>
                <span
                  className={`w-10 shrink-0 uppercase ${levelClasses[log.level] ?? levelClasses.info}`}
                >
                  {log.level}
                </span>
                <span className="min-w-0 whitespace-pre-wrap text-[#14151A]">
                  {log.stepId ? `[${log.stepId}] ` : ""}
                  {log.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card mt-6">
        <div className="card-head">
          <h2 className="card-title">Outputs</h2>
        </div>
        <pre className="code-block m-0 overflow-x-auto rounded-none border-0">
          {JSON.stringify(outputs, null, 2)}
        </pre>
      </section>

      {screenshots.length > 0 || otherArtifacts.length > 0 ? (
        <section className="card mt-6">
          <div className="card-head">
            <h2 className="card-title">Artifacts</h2>
          </div>
          <div className="space-y-4 px-7 py-6">
            {screenshots.map((artifact) => (
              <a
                key={artifact.id}
                href={`/api/artifacts/${artifact.id}`}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-2xl border border-[#E5E4DE] transition-opacity hover:opacity-95"
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
                className="block text-sm font-semibold underline underline-offset-2 text-[#14151A] transition-colors hover:text-[#3F5A00]"
              >
                Download {artifact.kind.toLowerCase()} artifact
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}