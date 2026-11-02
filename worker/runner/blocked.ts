import type { Page } from "playwright";

export type BlockedInfo = {
  blocked: boolean;
  reason?: string;
};

const BLOCK_SELECTORS: Array<{ selector: string; reason: string }> = [
  { selector: 'iframe[src*="recaptcha"]', reason: "reCAPTCHA challenge detected" },
  { selector: 'iframe[src*="hcaptcha"]', reason: "hCaptcha challenge detected" },
  { selector: 'iframe[src*="turnstile"]', reason: "Cloudflare Turnstile challenge detected" },
  { selector: "#challenge-form", reason: "Cloudflare challenge detected" },
  { selector: "#cf-challenge-running", reason: "Cloudflare challenge detected" },
];

const BLOCK_TEXT_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /verify (that )?you are (a )?human/i, reason: "Human verification page detected" },
  { pattern: /are you a robot/i, reason: "Bot verification page detected" },
  { pattern: /unusual traffic/i, reason: "Traffic challenge page detected" },
  { pattern: /checking your browser/i, reason: "Browser challenge page detected" },
  { pattern: /access denied/i, reason: "Access denied page detected" },
];

export function blockedFromStatus(status: number | null | undefined): string | null {
  if (status === 403) return "Navigation returned HTTP 403 (access denied)";
  if (status === 429) return "Navigation returned HTTP 429 (rate limited)";
  return null;
}

export async function detectBlocked(page: Page): Promise<BlockedInfo> {
  if (page.isClosed()) return { blocked: false };

  for (const check of BLOCK_SELECTORS) {
    const count = await page.locator(check.selector).count().catch(() => 0);
    if (count > 0) {
      return { blocked: true, reason: check.reason };
    }
  }

  const title = await page.title().catch(() => "");
  const bodyText = await page
    .locator("body")
    .innerText({ timeout: 1500 })
    .catch(() => "");
  const haystack = `${title}\n${bodyText}`;

  for (const check of BLOCK_TEXT_PATTERNS) {
    if (check.pattern.test(haystack)) {
      return { blocked: true, reason: check.reason };
    }
  }

  return { blocked: false };
}
