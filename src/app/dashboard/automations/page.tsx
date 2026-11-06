import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@shared/db";
import { PlusIcon } from "@/components/brand/icons";
import { AutomationsList, type AutomationRow } from "@/components/automations/automations-list";
import { PageLoading } from "@/components/dashboard/page-loading";
import { formatDateTime } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Automations",
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

  const rows: AutomationRow[] = automations.map((automation) => {
    const lastRun = automation.runs[0];
    return {
      id: automation.id,
      name: automation.name,
      status: automation.status,
      url: automation.description,
      updatedAt: formatDateTime(automation.updatedAt),
      lastRun: lastRun
        ? {
            id: lastRun.id,
            status: lastRun.status,
            createdAt: formatDateTime(lastRun.createdAt),
          }
        : null,
    };
  });

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="display text-[34px] leading-[1.05] tracking-[-0.035em] sm:text-[44px]">
            Automations
          </h1>
          <p className="mt-2.5 max-w-[520px] text-base leading-[1.55] text-[#5C6070]">
            Record a flow in a real browser, or import a definition, then run it on this machine.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/dashboard/automations/create" className="btn btn-dark">
            <PlusIcon size={16} className="text-[#C8F23B]" />
            Create automation
          </Link>
          <Link href="/dashboard/automations/import" className="btn btn-outline">
            Import JSON
          </Link>
        </div>
      </header>

      <AutomationsList automations={rows} />
    </div>
  );
}