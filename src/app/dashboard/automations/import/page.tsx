import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import exampleExtract from "@shared/examples/example-extract.json";
import exampleLogin from "@shared/examples/example-login.json";
import exampleScreenshot from "@shared/examples/example-screenshot.json";
import { ImportForm } from "@/components/automations/import-form";
import { PageLoading } from "@/components/dashboard/page-loading";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Import automation | Webtomate",
};

export default function ImportAutomationPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ImportAutomationContent />
    </Suspense>
  );
}

async function ImportAutomationContent() {
  await requireUser();

  const examples = [
    { label: "Extract page title", name: "Example extract", json: JSON.stringify(exampleExtract, null, 2) },
    { label: "Login flow", name: "Example login", json: JSON.stringify(exampleLogin, null, 2) },
    { label: "Screenshot flow", name: "Example screenshot", json: JSON.stringify(exampleScreenshot, null, 2) },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="space-y-6">
        <div>
          <Link
            href="/dashboard/automations"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← Automations
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Import automation</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Paste a definition JSON document. It is validated before it is saved and made runnable.
          </p>
        </div>

        <ImportForm examples={examples} />
      </div>
    </main>
  );
}
