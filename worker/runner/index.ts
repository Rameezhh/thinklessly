import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { redactSecrets } from "@shared/redact";
import { detectBlocked } from "./blocked";
import { executeStep } from "./steps";
import type { RunArtifactInfo, RunOptions, RunResult, StepContext } from "./types";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function captureFailureScreenshot(
  page: Page,
  runDir: string,
  artifacts: RunArtifactInfo[],
  stepId?: string,
): Promise<void> {
  try {
    if (page.isClosed()) return;
    await mkdir(runDir, { recursive: true });
    const safeStep = (stepId ?? "run").replace(/[^a-zA-Z0-9._-]/g, "_");
    const name = `failure-${safeStep}-${Date.now()}.png`;
    const path = join(runDir, name);
    await page.screenshot({ path, fullPage: true });
    artifacts.push({ kind: "SCREENSHOT", path, name });
  } catch {
    // Failure screenshots are best-effort only.
  }
}

export async function runAutomation(options: RunOptions): Promise<RunResult> {
  const { definition, inputs, secrets, runDir, onLog, shouldCancel } = options;
  const headless = options.headless ?? false;
  const settings = definition.settings;
  const outputs: Record<string, unknown> = {};
  const artifacts: RunArtifactInfo[] = [];

  const log = async (level: "info" | "warn" | "error", message: string, stepId?: string) => {
    try {
      await onLog?.({ level, message: redactSecrets(message, secrets), stepId });
    } catch {
      // Logging must never crash the run.
    }
  };

  await mkdir(runDir, { recursive: true });

  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;
  let currentStepId: string | undefined;
  let timedOut = false;

  const overallTimer = setTimeout(() => {
    timedOut = true;
    void context?.close().catch(() => undefined);
  }, settings.runTimeoutMs);

  try {
    browser = await chromium.launch({ headless });
    context = await browser.newContext({
      viewport: settings.viewport,
      userAgent: settings.userAgent,
      locale: settings.locale,
      timezoneId: settings.timezone,
    });
    page = await context.newPage();
    page.setDefaultTimeout(settings.stepTimeoutMs);

    await log("info", `Browser started (${headless ? "headless" : "visible"})`);

    const enabledSteps = definition.steps.filter((step) => step.enabled);
    await log("info", `Starting run with ${enabledSteps.length} enabled step(s)`);

    for (const step of enabledSteps) {
      if (timedOut) break;
      currentStepId = step.id;

      if (shouldCancel && (await shouldCancel())) {
        await log("warn", "Run cancelled by request", step.id);
        return { status: "CANCELLED", outputs, artifacts, error: "Run cancelled" };
      }

      await log("info", `Step ${step.id}: ${step.label ?? step.type}`, step.id);

      try {
        const stepContext: StepContext = {
          page,
          definition,
          settings,
          inputs,
          secrets,
          outputs,
          artifacts,
          runDir,
          timeout: step.timeoutMs ?? settings.stepTimeoutMs,
          log,
        };
        const outcome = await executeStep(step, stepContext);

        if (outcome.blocked?.blocked) {
          const reason = outcome.blocked.reason ?? "Human verification required";
          await log("warn", `${reason}. Human help is required.`, step.id);
          return { status: "NEEDS_HUMAN", outputs, artifacts, error: reason, failedStepId: step.id };
        }

        await log("info", `Step ${step.id}: done`, step.id);
      } catch (error) {
        const message = redactSecrets(errorMessage(error), secrets);
        const blocked = await detectBlocked(page);

        if (blocked.blocked) {
          const reason = blocked.reason ?? "Human verification required";
          await log("warn", `${reason}. Human help is required.`, step.id);
          return { status: "NEEDS_HUMAN", outputs, artifacts, error: reason, failedStepId: step.id };
        }

        if (step.optional) {
          await log("warn", `Optional step failed and was skipped: ${message}`, step.id);
          continue;
        }

        throw new Error(`Step "${step.id}" failed: ${message}`);
      }
    }

    if (timedOut) {
      return {
        status: "FAILED",
        outputs,
        artifacts,
        error: `Run timed out after ${settings.runTimeoutMs}ms`,
        failedStepId: currentStepId,
      };
    }

    await log("info", "Run completed successfully");
    return { status: "SUCCESS", outputs, artifacts };
  } catch (error) {
    if (timedOut) {
      return {
        status: "FAILED",
        outputs,
        artifacts,
        error: `Run timed out after ${settings.runTimeoutMs}ms`,
        failedStepId: currentStepId,
      };
    }

    if (page && !page.isClosed()) {
      await captureFailureScreenshot(page, runDir, artifacts, currentStepId);
    }

    const message = redactSecrets(errorMessage(error), secrets);
    await log("error", message, currentStepId);
    return { status: "FAILED", outputs, artifacts, error: message, failedStepId: currentStepId };
  } finally {
    clearTimeout(overallTimer);
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}
