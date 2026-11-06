import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/dashboard/page-loading";
import { LiveRecorder } from "@/components/live/live-recorder";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Live session ",
};

type SearchParams = Promise<{
  url?: string;
  name?: string;
  autostart?: string;
  fullscreen?: string;
}>;

export default function LivePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <LiveContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LiveContent({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const params = await searchParams;
  const url = typeof params.url === "string" ? params.url : "";
  const name = typeof params.name === "string" ? params.name : "";
  const autostart = params.autostart === "1";
  const fullscreen = params.fullscreen === "1";

  if (fullscreen) {
    return <LiveRecorder initialUrl={url} initialName={name} autostart={autostart} fullscreen />;
  }

  return (
    <div className="">
      <div className="mb-5">
        <h1 className="display text-[28px] leading-[1.1] tracking-[-0.03em]">Live session</h1>
        <p className="mt-1.5 text-sm text-[#5C6070]">
          The real site opens full screen in a new tab. Record actions and capture page data without any
          screen mirroring.
        </p>
      </div>
      <LiveRecorder initialUrl={url} initialName={name} />
    </div>
  );
}