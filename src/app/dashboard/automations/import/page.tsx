import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "@/components/brand/icons";
import { Suspense } from "react";
import exampleExtract from "@shared/examples/example-extract.json";
import exampleLogin from "@shared/examples/example-login.json";
import exampleScreenshot from "@shared/examples/example-screenshot.json";
import { ImportForm } from "@/components/automations/import-form";
import { PageLoading } from "@/components/dashboard/page-loading";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Import automation ",
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
    <div className="max-w-3xl">
      <div className="space-y-6">
        <div>
          <Link
            href="/dashboard/automations"
            className="link-arrow inline-flex items-center gap-2 text-[14px] font-semibold text-[#5C6070] transition-colors hover:text-[#14151A]"
          >
            <ArrowLeftIcon size={14} />
            Automations
          </Link>
          <h1 className="display mt-4 text-[34px] leading-[1.05] tracking-[-0.035em] sm:text-[44px]">Import automation</h1>
          <p className="mt-2.5 text-base leading-[1.55] text-[#5C6070]">
            Paste a definition JSON document. It is validated before it is saved and made runnable.
          </p>
        </div>

        <ImportForm examples={examples} />
      </div>
    </div>
  );
}
