import type { Page } from "playwright";
import { CHALLENGE_SELECTORS, CHALLENGE_TEXT_PATTERNS } from "@shared/obstructions";

export type BlockedInfo = {
  blocked: boolean;
  reason?: string;
};

export function blockedFromStatus(status: number | null | undefined): string | null {
  if (status === 403) return "Navigation returned HTTP 403 (access denied)";
  if (status === 429) return "Navigation returned HTTP 429 (rate limited)";
  return null;
}

/**
 * Detects real human/bot checks. These must never be auto-solved; the caller
 * pauses or fails the run with a clear reason. Hidden invisible-CAPTCHA frames
 * are ignored, which avoids false positives on normal pages.
 */
export async function detectBlocked(page: Page): Promise<BlockedInfo> {
  if (page.isClosed()) return { blocked: false };

  for (const selector of CHALLENGE_SELECTORS) {
    const candidate = page.locator(selector).first();
    if (await candidate.isVisible().catch(() => false)) {
      return { blocked: true, reason: "Human verification detected" };
    }
  }

  const hasTextChallenge = async (): Promise<boolean> => {
    const title = await page.title().catch(() => "");
    const bodyText = await page
      .locator("body")
      .innerText({ timeout: 1500 })
      .catch(() => "");
    const haystack = `${title}\n${bodyText}`;
    return CHALLENGE_TEXT_PATTERNS.some((pattern) => pattern.test(haystack));
  };

  if (await hasTextChallenge()) {
    return { blocked: true, reason: "Human verification page detected" };
  }

  return { blocked: false };
}