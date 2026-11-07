import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Browser, BrowserContext, Page } from "playwright";
import { resilienceSettings, stepCriticality } from "@shared/definition";
import type { OutputMeta } from "@shared/normalize";
import { redactSecrets } from "@shared/redact";
import { openBrowser, type BrowserSession } from "../browser/launch";
import { NetworkCollector } from "../network/collector";
import { detectBlocked } from "./blocked";
import { dismissObstructions, registerDialogHandler, stepTargetsObstruction } from "./obstruction";
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
  const resilience = resilienceSettings(settings);
  const obstructionOptions = {
    allowContinue: resilience.allowContinue,
    allowAcceptConsent: resilience.allowAcceptConsent,
  };
  const outputs: Record<string, unknown> = {};
  const meta: Record<string, OutputMeta> = {};
  const artifacts: RunArtifactInfo[] = [];

  const humanHelpResult = (reason: string, stepId: string): RunResult => {
    if (!settings.allowHumanHelp) {
      throw new Error(`${reason}. Human help is disabled for this automation.`);
    }
    return { status: "NEEDS_HUMAN", outputs, meta, artifacts, error: reason, failedStepId: stepId };
  };

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
  let session: BrowserSession | undefined;
  let page: Page | undefined;
  let network: NetworkCollector | undefined;
  let currentStepId: string | undefined;
  let timedOut = false;
  let networkCursor = Date.now();

  const overallTimer = setTimeout(() => {
    timedOut = true;
    void context?.close().catch(() => undefined);
  }, settings.runTimeoutMs);

  try {
    session = await openBrowser({
      headless,
      profileKey: options.profileKey,
      viewport: settings.viewport,
      userAgent: settings.userAgent,
      locale: settings.locale,
      timezone: settings.timezone,
    });
    browser = session.browser;
    context = session.context;
    page = context.pages()[0] ?? (await context.newPage());
    page.setDefaultTimeout(settings.stepTimeoutMs);
    registerDialogHandler(page, log);
    network = new NetworkCollector(context);

    await log("info", `Browser started (${headless ? "headless" : "visible"})`);

    const enabledSteps = definition.steps.filter((step) => step.enabled);
    await log("info", `Starting run with ${enabledSteps.length} enabled step(s)`);

    for (const step of enabledSteps) {
      if (timedOut) break;
      currentStepId = step.id;

      if (shouldCancel && (await shouldCancel())) {
        await log("warn", "Run cancelled by request", step.id);
        return { status: "CANCELLED", outputs, meta, artifacts, error: "Run cancelled" };
      }

      await log("info", `Step ${step.id}: ${step.label ?? step.type}`, step.id);

      if (step.type !== "extractApi") networkCursor = Date.now();

      const stepContext: StepContext = {
        page,
        definition,
        settings,
        inputs,
        secrets,
        outputs,
        meta,
        artifacts,
        runDir,
        timeout: step.timeoutMs ?? settings.stepTimeoutMs,
        log,
        network,
        networkCursor,
      };

      if (resilience.autoDismiss && !stepTargetsObstruction(step)) {
        const cleared = await dismissObstructions(page, log, step.id, obstructionOptions).catch(() => ({
          dismissed: false,
          challenge: undefined,
        }));
        if (cleared.challenge) {
          await log("warn", `${cleared.challenge}. Human help is required.`, step.id);
          return humanHelpResult(cleared.challenge, step.id);
        }
      }

      let attempt = 0;
      for (;;) {
        try {
          const outcome = await executeStep(step, stepContext);

          if (outcome.blocked?.blocked) {
            const reason = outcome.blocked.reason ?? "Human verification required";
            await log("warn", `${reason}.`, step.id);
            return humanHelpResult(reason, step.id);
          }

          await log("info", `Step ${step.id}: done`, step.id);
          break;
        } catch (error) {
          const message = redactSecrets(errorMessage(error), secrets);
          const blocked = await detectBlocked(page);

          if (blocked.blocked) {
            const reason = blocked.reason ?? "Human verification required";
            await log("warn", `${reason}.`, step.id);
            return humanHelpResult(reason, step.id);
          }

          if (attempt === 0 && resilience.autoDismiss) {
            const cleared = await dismissObstructions(page, log, step.id, obstructionOptions).catch(() => ({
              dismissed: false,
              challenge: undefined,
            }));
            if (cleared.challenge) {
              await log("warn", `${cleared.challenge}. Human help is required.`, step.id);
              return humanHelpResult(cleared.challenge, step.id);
            }
            if (cleared.dismissed) {
              await log("warn", "Cleared an unexpected popup; retrying the step.", step.id);
              attempt += 1;
              continue;
            }
          }

          const criticality = stepCriticality(step);
          if (criticality !== "required") {
            await log("warn", `${criticality} step failed and was skipped: ${message}`, step.id);
            break;
          }

          throw new Error(`Step "${step.id}" failed: ${message}`);
        }
      }
    }

    if (timedOut) {
      return {
        status: "FAILED",
        outputs,
        meta,
        artifacts,
        error: `Run timed out after ${settings.runTimeoutMs}ms`,
        failedStepId: currentStepId,
      };
    }

    await log("info", "Run completed successfully");
    return { status: "SUCCESS", outputs, meta, artifacts };
  } catch (error) {
    if (timedOut) {
      return {
        status: "FAILED",
        outputs,
        meta,
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
    return { status: "FAILED", outputs, meta, artifacts, error: message, failedStepId: currentStepId };
  } finally {
    clearTimeout(overallTimer);
    if (session) {
      await session.close();
    } else if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}
