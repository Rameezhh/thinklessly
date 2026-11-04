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
import { autoPayloadAction } from "@/lib/automation-field-actions";
import { Button } from "@/components/ui/button";
import { CredentialsPanel } from "@/components/automations/credentials-panel";
import { DefinitionView } from "@/components/automations/definition-view";
import { OutputsPanel } from "@/components/automations/outputs-panel";
import { PayloadPanel } from "@/components/automations/payload-panel";
import { RunForm } from "@/components/automations/run-form";
import { TriggersPanel, type TriggerRow } from "@/components/automations/triggers-panel";
import { PageLoading } from "@/components/dashboard/page-loading";
import { formatDateTime, statusClasses } from "@/lib/format";
import { findAutomation } from "@/lib/ownership";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Automation | Webtomate",
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
        (step): step is Extract<Step, { type: "extract" | "extractStructured" }> =>
          step.type === "extract" || step.type === "extractStructured",
      )
    : [];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="space-y-6">
        <div>
          <Link
            href="/dashboard/automations"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← Automations
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{automation.name}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusClasses(automation.status)}`}
            >
              {automation.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {automation.currentVersion
              ? `Version ${automation.currentVersion.versionNumber} · published ${formatDateTime(automation.currentVersion.createdAt)}`
              : "No published version"}
          </p>
          {automation.description ? (
            <a
              href={automation.description}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block truncate text-xs font-mono text-zinc-500 hover:underline dark:text-zinc-400"
            >
              {automation.description}
            </a>
          ) : null}
        </div>

        {!automation.currentVersion ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            This automation has no published version, so it cannot run yet.
          </p>
        ) : definitionError ? (
          <p
            role="alert"
            className="whitespace-pre-line rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            {definitionError}
          </p>
        ) : definition ? (
          <>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
              <DefinitionView automationId={automation.id} definition={definition} />
              <aside className="lg:sticky lg:top-6 lg:self-start">
                <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Run now</h2>
                  <p className="mb-4 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Fill the inputs and queue one manual run.
                  </p>
                  <RunForm
                    automationId={automation.id}
                    fields={definition.fields}
                    savedSecretKeys={savedSecrets.map((secret) => secret.fieldKey)}
                  />
                </section>
              </aside>
            </div>
            {needsAutoPayload ? (
              <form action={autoPayloadAction.bind(null, automation.id)}>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200/70 bg-indigo-50/60 px-4 py-3 dark:border-indigo-900/50 dark:bg-indigo-950/30">
                  <p className="text-sm text-indigo-900 dark:text-indigo-200">
                    Some recorded inputs are still fixed values. Move them to the payload so they can be
                    overridden at run time.
                  </p>
                  <Button type="submit" size="sm">
                    Add recorded values to payload
                  </Button>
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
          </>
        ) : null}
      </div>
    </main>
  );
}
