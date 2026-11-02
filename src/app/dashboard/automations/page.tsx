import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@shared/db";
import { PageLoading } from "@/components/dashboard/page-loading";
import { formatDateTime, statusClasses } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Automations | Webtomate",
};

export default function AutomationsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <AutomationsContent />
    </Suspense>
  );
}

async function AutomationsContent() {
  const user = await requireUser();

  const automations = await prisma.automation.findMany({
    where: { teamId: user.teamId },
    orderBy: { updatedAt: "desc" },
    include: {
      runs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, createdAt: true },
      },
    },
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Automations</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Record a flow in a real browser, or import a definition, then run it on this machine.
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
              Import JSON
            </Link>
          </div>
        </header>

        {automations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-950">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No automations yet</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Record your first flow in a real browser, or import a definition JSON document.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
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
                Import JSON
              </Link>
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {automations.map((automation) => {
              const lastRun = automation.runs[0];
              return (
                <li
                  key={automation.id}
                  className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/dashboard/automations/${automation.id}`}
                          className="truncate text-base font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
                        >
                          {automation.name}
                        </Link>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusClasses(automation.status)}`}
                        >
                          {automation.status}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {automation.description ?? "No description"} · updated {formatDateTime(automation.updatedAt)}
                      </p>
                      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                        Last run:{" "}
                        {lastRun ? (
                          <Link href={`/dashboard/runs/${lastRun.id}`} className="font-medium hover:underline">
                            {lastRun.status} · {formatDateTime(lastRun.createdAt)}
                          </Link>
                        ) : (
                          "never"
                        )}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/dashboard/automations/${automation.id}`}
                        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
