import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RecorderPanel } from "@/components/automations/recorder-panel";
import { PageLoading } from "@/components/dashboard/page-loading";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Create automation | Webtomate",
};

export default function CreateAutomationPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <CreateAutomationContent />
    </Suspense>
  );
}

async function CreateAutomationContent() {
  await requireUser();
  const recorderPort = process.env.RECORDER_PORT ?? "4001";

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="space-y-6">
        <div>
          <Link
            href="/dashboard/automations"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← Automations
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Create automation</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Enter the starting URL, record your actions in the browser window that opens, then click End automation.
          </p>
        </div>

        <RecorderPanel recorderPort={recorderPort} />
      </div>
    </main>
  );
}
