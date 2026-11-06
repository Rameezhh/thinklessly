import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@shared/db";
import { ArrowRightIcon, PlusIcon } from "@/components/brand/icons";
import { PageLoading } from "@/components/dashboard/page-loading";
import { StatusPill } from "@/components/ui/status-pill";
import { formatDateTime } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const user = await requireUser();

  const [automationCount, recentRuns] = await Promise.all([
    prisma.automation.count({ where: { teamId: user.teamId } }),
    prisma.run.findMany({
      where: { teamId: user.teamId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { automation: { select: { id: true, name: true } } },
    }),
  ]);

  const successCount = recentRuns.filter((run) => run.status === "SUCCESS").length;
  const successRate = recentRuns.length ? Math.round((successCount / recentRuns.length) * 100) : null;
  const bars = recentRuns.length
    ? recentRuns.map((run) =>
        run.status === "SUCCESS" ? "#C8F23B" : run.status === "FAILED" ? "#FF6B5E" : "#8A8E9E",
      )
    : Array.from({ length: 5 }, () => "#2A2D38");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <span className="pill pill-lime">{user.teamName}</span>
          <h1 className="display mt-3.5 text-[34px] leading-[1.05] tracking-[-0.035em] sm:text-[44px]">
            Welcome, {user.name}
          </h1>
          <p className="mt-2.5 text-[15px] text-[#5C6070]">
            Signed in as {user.email} · {user.role.toUpperCase()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/dashboard/automations/create" className="btn btn-dark">
            <PlusIcon size={16} className="text-[#C8F23B]" />
            Create automation
          </Link>
          <Link href="/dashboard/automations/import" className="btn btn-outline">
            Import automation
          </Link>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="hover-lift rounded-[20px] border border-[#E5E4DE] bg-white p-6">
          <div className="mono text-[12px] tracking-[0.06em] text-[#5C6070]">AUTOMATIONS</div>
          <div className="display mt-3.5 text-[48px] leading-none tracking-[-0.03em]">
            {automationCount}
          </div>
        </div>

        <div className="hover-lift rounded-[20px] border border-[#E5E4DE] bg-white p-6">
          <div className="mono text-[12px] tracking-[0.06em] text-[#5C6070]">RECENT RUNS</div>
          <div className="display mt-3.5 text-[48px] leading-none tracking-[-0.03em]">
            {recentRuns.length}
          </div>
        </div>

        <div className="hover-lift rounded-[20px] border border-[#0E0F13] bg-[#0E0F13] p-6 text-white">
          <div className="mono text-[12px] tracking-[0.06em] text-[#A3A7B5]">SUCCESS RATE</div>
          <div className="mt-3.5 flex items-baseline gap-3">
            <span className="display text-[48px] leading-none tracking-[-0.03em] text-[#C8F23B]">
              {successRate === null ? "—" : `${successRate}%`}
            </span>
            <span className="text-[13px] text-[#A3A7B5]">
              {recentRuns.length ? "last 5 runs" : "no runs yet"}
            </span>
          </div>
          <div
            className="mt-4 flex gap-1.5"
            role="img"
            aria-label={
              recentRuns.length
                ? `Last ${recentRuns.length} runs: ${successCount} succeeded, ${recentRuns.length - successCount} not successful`
                : "No runs yet"
            }
          >
            {bars.map((color, index) => (
              <span
                key={index}
                className="h-2 flex-1 rounded"
                style={{ backgroundColor: color, transition: "background-color 0.3s ease" }}
              />
            ))}
          </div>
        </div>

        <div className="hover-lift rounded-[20px] border border-[#E5E4DE] bg-white p-6">
          <div className="mono text-[12px] tracking-[0.06em] text-[#5C6070]">TEAM ROLE</div>
          <div className="display mt-3.5 text-[36px] leading-[1.3] tracking-[-0.02em]">
            {user.role.toUpperCase()}
          </div>
        </div>
      </div>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E4DE] px-7 py-[22px]">
          <h2 className="display text-[22px] font-bold tracking-[-0.02em]">Recent runs</h2>
          <Link
            href="/dashboard/automations"
            className="link-arrow inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#14151A]"
          >
            View automations
            <ArrowRightIcon size={14} />
          </Link>
        </div>

        {recentRuns.length === 0 ? (
          <div className="px-7 py-10 text-center">
            <p className="text-base font-semibold text-[#14151A]">No runs yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-[#5C6070]">
              Create or import an automation and run it to see results here.
            </p>
            <Link href="/dashboard/automations/create" className="btn btn-dark btn-sm mt-4">
              Create automation
            </Link>
          </div>
        ) : (
          <ul className="stagger">
            {recentRuns.map((run, index) => (
              <li key={run.id} className={index < recentRuns.length - 1 ? "border-b border-[#EFEEE8]" : ""}>
                <Link
                  href={`/dashboard/runs/${run.id}`}
                  className="flex flex-wrap items-center justify-between gap-4 px-7 py-[18px] transition-colors hover:bg-[#FBFBF9]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold">{run.automation.name}</div>
                    <div className="mono mt-1 text-[12px] text-[#5C6070]">
                      {run.triggerSource.toUpperCase()} · {formatDateTime(run.createdAt)}
                    </div>
                  </div>
                  <StatusPill status={run.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}