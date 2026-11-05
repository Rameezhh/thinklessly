import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/dashboard/page-loading";
import { LiveRecorder } from "@/components/live/live-recorder";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Live session | Webtomate",
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
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Live session</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          The real site opens full screen in a new tab. Record actions and capture page data without any
          screen mirroring.
        </p>
      </div>
      <LiveRecorder initialUrl={url} initialName={name} />
    </main>
  );
}