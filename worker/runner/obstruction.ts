import type { Page } from "playwright";
import type { Step } from "@shared/definition";
import type { LogLevel } from "./types";

type Log = (level: LogLevel, message: string, stepId?: string) => Promise<void>;

const DIALOG_SELECTORS = [
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[data-testid*="modal" i]',
  '[data-testid*="overlay" i]',
  '[class*="modal" i]',
  '[class*="overlay" i]',
  '[class*="backdrop" i]',
];

const CLOSE_CONTROLS = [
  '[aria-label*="close" i]',
  '[aria-label*="dismiss" i]',
  '[title*="close" i]',
  '[data-testid*="close" i]',
  '[data-testid*="dismiss" i]',
  'button[class*="close" i]',
  '[class*="close" i]',
];

const CLOSE_TEXTS = [
  "close",
  "dismiss",
  "not now",
  "no thanks",
  "maybe later",
  "got it",
  "ok",
  "okay",
  "accept",
  "continue",
  "later",
  "skip",
];

async function isVisible(target: ReturnType<Page["locator"]>): Promise<boolean> {
  return target.isVisible().catch(() => false);
}

/** True when the step deliberately interacts with a dialog, overlay, or close control. */
export function stepTargetsObstruction(step: Step): boolean {
  if (!("selectors" in step) || !step.selectors) return false;
  const haystack = step.selectors
    .map((selector) => `${selector.kind} ${selector.value} ${selector.name ?? ""}`)
    .join(" ")
    .toLowerCase();
  return /(overlay|modal|backdrop|dialog|popup|close|dismiss)/.test(haystack);
}

/**
 * Best-effort removal of unexpected overlays, modals, and popups so a run can
 * continue. Returns true when something was dismissed.
 */
export async function dismissObstructions(page: Page, log: Log, stepId?: string): Promise<boolean> {
  if (page.isClosed()) return false;

  let dialog: ReturnType<Page["locator"]> | null = null;
  for (const selector of DIALOG_SELECTORS) {
    const candidate = page.locator(selector).first();
    if (await isVisible(candidate)) {
      dialog = candidate;
      break;
    }
  }
  if (!dialog) return false;

  for (const selector of CLOSE_CONTROLS) {
    const control = dialog.locator(selector).first();
    if (!(await isVisible(control))) continue;
    if (await control.click({ timeout: 1500 }).then(() => true).catch(() => false)) {
      await log("info", "Dismissed an unexpected popup (close control)", stepId);
      await page.waitForTimeout(200);
      return true;
    }
  }

  for (const text of CLOSE_TEXTS) {
    const control = dialog.getByRole("button", { name: text }).first();
    if (!(await isVisible(control))) continue;
    if (await control.click({ timeout: 1500 }).then(() => true).catch(() => false)) {
      await log("info", `Dismissed an unexpected popup (button "${text}")`, stepId);
      await page.waitForTimeout(200);
      return true;
    }
  }

  try {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  } catch {
    return false;
  }
  if (!(await isVisible(dialog))) {
    await log("info", "Dismissed an unexpected popup (Escape)", stepId);
    return true;
  }

  return false;
}
