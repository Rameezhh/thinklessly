import type { Page } from "playwright";

function cap(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

async function quiet(page: Page, timeoutMs: number): Promise<void> {
  if (page.isClosed()) return;
  await Promise.race([
    page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => undefined),
    page.waitForTimeout(cap(timeoutMs, 400, 1200)),
  ]);
}

/**
 * Waits for a navigation to settle without ever blocking on a page that keeps
 * long-lived connections open. Network-idle is capped and raced with a short
 * fixed wait, so it can only help.
 */
export async function settleAfterNavigation(page: Page, timeoutMs: number): Promise<void> {
  if (page.isClosed()) return;
  const timeout = cap(timeoutMs, 1000, 15000);
  await page.waitForLoadState("domcontentloaded", { timeout }).catch(() => undefined);
  await quiet(page, timeout);
  await page.waitForTimeout(120).catch(() => undefined);
}

/** Waits briefly for a click/fill to produce a navigation or DOM update. */
export async function settleAfterAction(page: Page, timeoutMs: number): Promise<void> {
  if (page.isClosed()) return;
  await quiet(page, cap(timeoutMs, 500, 2500));
}
