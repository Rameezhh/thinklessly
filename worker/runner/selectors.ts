import type { Locator, Page } from "playwright";
import type { Selector } from "@shared/definition";
import type { LogFn } from "./types";

function toLocator(page: Page, selector: Selector): Locator {
  switch (selector.kind) {
    case "testid":
      return page.getByTestId(selector.value);
    case "role":
      return page.getByRole(selector.value as Parameters<Page["getByRole"]>[0], {
        name: selector.name,
      });
    case "label":
      return page.getByLabel(selector.value);
    case "placeholder":
      return page.getByPlaceholder(selector.value);
    case "text":
      return page.getByText(selector.value);
    case "css":
      return page.locator(selector.value);
    case "xpath":
      return page.locator(`xpath=${selector.value}`);
  }
}

export type ResolvedLocator = {
  locator: Locator;
  selector: Selector;
};

export async function resolveLocator(
  page: Page,
  selectors: Selector[],
  timeoutMs: number,
  log: LogFn,
  stepId?: string,
): Promise<ResolvedLocator> {
  const slice = Math.max(500, Math.min(2500, Math.floor(timeoutMs / selectors.length)));
  const failures: string[] = [];

  for (let index = 0; index < selectors.length; index += 1) {
    const selector = selectors[index];
    if (!selector) continue;

    try {
      const locator = toLocator(page, selector).first();
      await locator.waitFor({ state: "visible", timeout: slice });
      await log({
        level: "info",
        message: `Selector ${index + 1}/${selectors.length} matched (${selector.kind}): ${selector.value}`,
        stepId,
      });
      return { locator, selector };
    } catch {
      failures.push(`${selector.kind}:${selector.value}`);
      await log({
        level: "info",
        message: `Selector ${index + 1}/${selectors.length} did not match (${selector.kind}): ${selector.value}`,
        stepId,
      });
    }
  }

  throw new Error(`No selector matched. Tried: ${failures.join(", ")}`);
}
