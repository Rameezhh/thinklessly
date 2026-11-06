import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeftIcon } from "@/components/brand/icons";
import { CreateAside } from "@/components/automations/create-aside";
import { RecorderPanel } from "@/components/automations/recorder-panel";
import { PageLoading } from "@/components/dashboard/page-loading";
import { LiveRecorder } from "@/components/live/live-recorder";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Create automation",
};

const liveRecorder = process.env.LIVE_RECORDER !== "false";

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
    <div>
      <Link
        href="/dashboard/automations"
        className="link-arrow inline-flex items-center gap-2 text-[14px] font-semibold text-[#5C6070] transition-colors hover:text-[#14151A]"
      >
        <ArrowLeftIcon size={14} />
        Automations
      </Link>
      <h1 className="display mt-4 text-[34px] leading-[1.05] tracking-[-0.035em] sm:text-[44px]">
        Create automation
      </h1>
      <p className="mt-2.5 max-w-[600px] text-base leading-[1.55] text-[#5C6070]">
        Enter the starting URL, use the live site and floating toolbar, then click End automation.
      </p>

      <div className="mt-9 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-3xl border border-[#E5E4DE] bg-white p-6 sm:p-9">
          {liveRecorder ? <LiveRecorder initialUrl="" /> : <RecorderPanel recorderPort={recorderPort} />}
        </div>
        <CreateAside />
      </div>
    </div>
  );
}