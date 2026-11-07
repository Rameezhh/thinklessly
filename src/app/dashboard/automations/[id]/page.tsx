import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@shared/db";
import {
  DefinitionError,
  parseDefinition,
  validateFieldReferences,
  type AutomationDefinition,
  type Step,
} from "@shared/definition";
import { ArrowLeftIcon } from "@/components/brand/icons";
import { autoPayloadAction } from "@/lib/automation-field-actions";
import { CredentialsPanel } from "@/components/automations/credentials-panel";
import { DefinitionView } from "@/components/automations/definition-view";
import { OutputsPanel } from "@/components/automations/outputs-panel";
import { PayloadPanel } from "@/components/automations/payload-panel";
import { RunForm } from "@/components/automations/run-form";
import { TriggersPanel, type TriggerRow } from "@/components/automations/triggers-panel";
import { PageLoading } from "@/components/dashboard/page-loading";
import { StatusPill } from "@/components/ui/status-pill";
import { formatDateTime } from "@/lib/format";
import { findAutomation } from "@/lib/ownership";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Automation",
};

export default function AutomationPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <AutomationContent params={params} />
    </Suspense>
  );
}

async function AutomationContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const automation = await findAutomation(user.teamId, id);
  if (!automation) notFound();

  const [savedSecrets, triggers] = await Promise.all([
    prisma.secret.findMany({
      where: { automationId: automation.id },
      select: { fieldKey: true },
    }),
    prisma.trigger.findMany({
      where: { automationId: automation.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const triggerRows: TriggerRow[] = triggers.map((trigger) => ({
    id: trigger.id,
    type: trigger.type,
    cronExpression: trigger.cronExpression,
    timezone: trigger.timezone,
    delaySeconds: trigger.delaySeconds,
    enabled: trigger.enabled,
    nextRunAt: trigger.nextRunAt ? formatDateTime(trigger.nextRunAt) : null,
    lastFiredAt: trigger.lastFiredAt ? formatDateTime(trigger.lastFiredAt) : null,
  }));
  const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  let definition: AutomationDefinition | null = null;
  let definitionError: string | null = null;
  if (automation.currentVersion) {
    try {
      definition = parseDefinition(automation.currentVersion.definition);
      const issues = validateFieldReferences(definition);
      if (issues.length > 0) definitionError = issues.map((issue) => issue.message).join("\n");
    } catch (error) {
      definitionError =
        error instanceof DefinitionError ? error.issues.join("\n") : "The stored definition is invalid.";
    }
  }

  const needsAutoPayload = Boolean(
    definition?.steps.some((step) => {
      if (step.type === "fill") return step.value.mode === "literal" && step.value.text.length > 0;
      if (step.type === "select") return typeof step.value === "string" || step.value.mode === "literal";
      if (step.type === "check") return typeof step.checked === "boolean";
      return false;
    }),
  );

  const extractionSteps = definition
    ? definition.steps.filter(
        (step): step is Extract<Step, { type: "extract" | "extractStructured" | "extractApi" }> =>
          step.type === "extract" || step.type === "extractStructured" || step.type === "extractApi",
      )
    : [];

  return (
    <div>
      <Link
        href="/dashboard/automations"
        className="link-arrow inline-flex items-center gap-2 text-[14px] font-semibold text-[#5C6070] transition-colors hover:text-[#14151A]"
      >
        <ArrowLeftIcon size={14} />
        Automations
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3.5">
        <h1 className="display text-[34px] leading-[1.05] tracking-[-0.035em] sm:text-[44px]">
          {automation.name}
        </h1>
        <StatusPill status={automation.status} />
      </div>
      <p className="mt-2.5 text-[15px] text-[#5C6070]">
        {automation.currentVersion
          ? `Version ${automation.currentVersion.versionNumber} · published ${formatDateTime(automation.currentVersion.createdAt)}`
          : "No published version"}
      </p>
      {automation.description ? (
        <a
          href={automation.description}
          target="_blank"
          rel="noreferrer"
          className="mono mt-1.5 inline-block max-w-full truncate text-[13px] text-[#5C6070] transition-colors hover:text-[#14151A]"
        >
          {automation.description}
        </a>
      ) : null}

      {!automation.currentVersion ? (
        <p className="mt-8 rounded-2xl border-[1.5px] border-dashed border-[#D8D6CE] bg-[#FBFBF9] px-4 py-3.5 text-sm text-[#5C6070]">
          This automation has no published version, so it cannot run yet.
        </p>
      ) : definitionError ? (
        <p
          role="alert"
          className="mt-8 whitespace-pre-line rounded-2xl border border-[#F2C5C0] bg-[#FDE8E6] px-4 py-3.5 text-sm text-[#B42318]"
        >
          {definitionError}
        </p>
      ) : definition ? (
        <>
          <div className="mt-9 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
            <div className="flex min-w-0 flex-col gap-6">
              <DefinitionView automationId={automation.id} definition={definition} />

              {needsAutoPayload ? (
                <form action={autoPayloadAction.bind(null, automation.id)}>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#CFE58A] bg-[#FAFDEB] px-4 py-3.5">
                    <p className="text-sm leading-relaxed text-[#3F5A00]">
                      Some recorded inputs are still fixed values. Move them to the payload so they
                      can be overridden at run time.
                    </p>
                    <button type="submit" className="btn btn-dark btn-sm">
                      Add recorded values to payload
                    </button>
                  </div>
                </form>
              ) : null}

              <PayloadPanel
                key={`payload-${automation.currentVersion.id}`}
                automationId={automation.id}
                fields={definition.fields}
                steps={definition.steps}
              />
              <OutputsPanel
                key={automation.currentVersion.id}
                automationId={automation.id}
                steps={extractionSteps}
              />
              <CredentialsPanel
                key={`credentials-${automation.currentVersion.id}`}
                automationId={automation.id}
                fields={definition.fields}
                steps={definition.steps}
                savedSecretKeys={savedSecrets.map((secret) => secret.fieldKey)}
              />
              <TriggersPanel
                automationId={automation.id}
                triggers={triggerRows}
                defaultTimezone={defaultTimezone}
              />
            </div>

            <aside className="xl:sticky xl:top-6 xl:self-start">
              <div className="rounded-3xl bg-[#0E0F13] p-7 text-white">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#C8F23B]" />
                  <h2 className="display text-[22px] font-bold tracking-[-0.02em]">Run now</h2>
                </div>
                <p className="mt-3 text-sm leading-[1.55] text-[#A3A7B5]">
                  Fill the inputs and queue one manual run.
                </p>
                <div className="mt-4">
                  <RunForm
                    automationId={automation.id}
                    fields={definition.fields}
                    savedSecretKeys={savedSecrets.map((secret) => secret.fieldKey)}
                  />
                </div>
              </div>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}