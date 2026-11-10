import type { Locator, Page } from "playwright";
import {
  CLOSE_SELECTORS,
  consentContinueLabels,
  continueLabelsFor,
  dismissLabelsFor,
  genericDismissLabels,
  type ObstructionKind,
} from "@shared/obstructions";
import {
  clickOnce,
  isVisible,
  overlayChallenge,
  overlayControls,
  pickControl,
} from "./obstruction-helpers";
import type { Log, ObstructionOptions, ObstructionResult, Overlay } from "./obstruction-types";

async function hideBenignOverlay(overlay: Locator, kind: ObstructionKind): Promise<boolean> {
  if (kind !== "consent" && kind !== "newsletter" && kind !== "app") return false;
  const hasPassword = await overlay
    .evaluate((el) => Boolean(el.querySelector("input[type='password']")))
    .catch(() => true);
  if (hasPassword) return false;
  return overlay
    .evaluate((el) => {
      (el as HTMLElement).style.setProperty("display", "none", "important");
      return true;
    })
    .catch(() => false);
}

export async function dismissOverlay(
  page: Page,
  overlay: Overlay,
  log: Log,
  stepId: string | undefined,
  options: ObstructionOptions,
): Promise<ObstructionResult> {
  const challenge = await overlayChallenge(overlay.locator);
  if (challenge) {
    await log("warn", `Detected a ${overlay.kind} human check; leaving it for the user`, stepId);
    return { dismissed: false, challenge };
  }

  for (const selector of CLOSE_SELECTORS) {
    const control = overlay.locator.locator(selector).first();
    if (await clickOnce(control)) {
      await page.waitForTimeout(180);
      if (!(await isVisible(overlay.locator))) return { dismissed: true };
    }
  }

  const controls = await overlayControls(overlay.locator);
  const labelSets: string[][] = [dismissLabelsFor(overlay.kind), genericDismissLabels()];
  if (options.allowContinue !== false) labelSets.push(continueLabelsFor(overlay.kind));
  if (overlay.kind === "consent" && options.allowAcceptConsent) {
    labelSets.push(consentContinueLabels());
  }

  for (const labels of labelSets) {
    const control = pickControl(controls, labels);
    if (!control) continue;
    if (await clickOnce(control.locator)) {
      await log("info", `Dismissed ${overlay.kind} overlay ("${control.label}")`, stepId);
      await page.waitForTimeout(220);
      if (!(await isVisible(overlay.locator))) return { dismissed: true };
    }
  }

  if (overlay.kind !== "consent") {
    try {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    } catch {
      // Keyboard may be unavailable on a closed page.
    }
    if (!(await isVisible(overlay.locator))) {
      await log("info", `Dismissed ${overlay.kind} overlay (Escape)`, stepId);
      return { dismissed: true };
    }
  }

  if (await hideBenignOverlay(overlay.locator, overlay.kind)) {
    await log("info", `Hid ${overlay.kind} overlay (no usable dismiss control)`, stepId);
    return { dismissed: true };
  }

  return { dismissed: false };
}