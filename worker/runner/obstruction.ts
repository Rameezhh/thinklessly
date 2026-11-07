import type { Page } from "playwright";
import type { Step } from "@shared/definition";
import { continueLabelsFor, isDangerousLabel, looksLikeChallenge } from "@shared/obstructions";
import { dismissOverlay } from "./obstruction-actions";
import { findFloatingOverlay, findKnownOverlay } from "./obstruction-find";
import { clickOnce, isVisible, pickControl } from "./obstruction-helpers";
import type { Control, Log, ObstructionOptions, ObstructionResult } from "./obstruction-types";

export type { Log, ObstructionOptions, ObstructionResult } from "./obstruction-types";

const handledDialogs = new WeakSet<Page>();

/** Auto-dismisses native alert/confirm dialogs and accepts beforeunload navigations. */
export function registerDialogHandler(page: Page, log: Log): void {
  if (handledDialogs.has(page)) return;
  handledDialogs.add(page);
  page.on("dialog", (dialog) => {
    void (async () => {
      try {
        const type = dialog.type();
        if (type === "beforeunload") await dialog.accept();
        else await dialog.dismiss();
        await log("info", `Dismissed native ${type} dialog`, undefined);
      } catch {
        // A dialog that already closed is not an error.
      }
    })();
  });
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

const PAGE_INTERSTITIAL =
  /before you (continue|proceed)|continue (shopping|to the site|to amazon)|choose your (region|country|location)|select your (region|country|location)|you are about to leave|age verification|are you (18|over 18)/i;

/**
 * Handles full-page interstitials ("Continue shopping", region/age gates) that
 * are not wrapped in a floating overlay. Only clicks when exactly one visible
 * safe continue control exists, which keeps it from guessing.
 */
async function dismissPageInterstitial(page: Page, log: Log, stepId?: string): Promise<boolean> {
  const body = await page
    .locator("body")
    .innerText({ timeout: 1500 })
    .catch(() => "");
  if (!body || !PAGE_INTERSTITIAL.test(body)) return false;
  if (looksLikeChallenge(body)) return false;

  const labels = [
    ...continueLabelsFor("interstitial"),
    ...continueLabelsFor("region"),
    ...continueLabelsFor("age"),
  ];
  const controls = page.locator(
    "button, a, [role='button'], input[type='submit'], input[type='button']",
  );
  const count = Math.min(await controls.count().catch(() => 0), 80);
  const matches: Control[] = [];

  for (let index = 0; index < count; index += 1) {
    const locator = controls.nth(index);
    if (!(await isVisible(locator))) continue;
    const label = await locator
      .evaluate((el) => {
        const input = el as HTMLInputElement;
        return ((el as HTMLElement).innerText || input.value || el.getAttribute("aria-label") || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 120);
      })
      .catch(() => "");
    if (!label || isDangerousLabel(label)) continue;
    if (pickControl([{ locator, label }], labels)) matches.push({ locator, label });
    if (matches.length > 1) break;
  }

  if (matches.length !== 1) return false;
  if (!(await clickOnce(matches[0].locator))) return false;

  await log("info", `Dismissed page interstitial ("${matches[0].label}")`, stepId);
  await page.waitForTimeout(400);
  return true;
}

/**
 * Best-effort removal of unexpected overlays, modals, cookie banners, region
 * prompts and interstitials. Real human/CAPTCHA checks are reported instead of
 * clicked, so the caller can pause or fail with a clear reason.
 */
export async function dismissObstructions(
  page: Page,
  log: Log,
  stepId?: string,
  options: ObstructionOptions = {},
): Promise<ObstructionResult> {
  if (page.isClosed()) return { dismissed: false };

  let dismissed = false;

  for (let pass = 0; pass < 5; pass += 1) {
    // Cookie/consent managers often render inside an iframe, so scan frames as
    // well as the main document. The main frame is first.
    const frames = page
      .frames()
      .filter((frame) => !frame.isDetached() && (frame === page.mainFrame() || /^https?:/i.test(frame.url())))
      .slice(0, 6);

    let acted = false;
    for (const frame of frames) {
      const overlay = (await findKnownOverlay(frame)) ?? (await findFloatingOverlay(frame));
      if (!overlay) continue;

      const result = await dismissOverlay(page, overlay, log, stepId, options);
      if (result.challenge) return { dismissed, challenge: result.challenge };
      if (!result.dismissed) continue;

      dismissed = true;
      acted = true;
      break;
    }

    if (!acted) break;
    await page.waitForTimeout(120);
  }

  if (await dismissPageInterstitial(page, log, stepId)) dismissed = true;

  return { dismissed };
}