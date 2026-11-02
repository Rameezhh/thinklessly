import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@shared/db";
import { PageLoading } from "@/components/dashboard/page-loading";
import { formatDateTime, statusClasses } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Dashboard | Webtomate",
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

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{user.teamName}</p>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Welcome, {user.name}</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Signed in as {user.email} · {user.role}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/automations/create"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Create automation
            </Link>
            <Link
              href="/dashboard/automations/import"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Import automation
            </Link>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Automations
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{automationCount}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Recent runs
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{recentRuns.length}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Team role
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{user.role}</p>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recent runs</h2>
            <Link
              href="/dashboard/automations"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              View automations
            </Link>
          </div>

          {recentRuns.length === 0 ? (
            <p className="px-5 py-8 text-sm text-zinc-500 dark:text-zinc-400">
              No runs yet. Create or import an automation and run it to see results here.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {recentRuns.map((run) => (
                <li key={run.id}>
                  <Link
                    href={`/dashboard/runs/${run.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{run.automation.name}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {run.triggerSource} · {formatDateTime(run.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusClasses(run.status)}`}
                    >
                      {run.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
