import type { Locator, Page } from "playwright";
import type { Condition, ConditionOperator, Selector } from "@shared/definition";
import { resolveLocator, toLocator } from "./selectors";

export function matchConditionValue(
  actual: string,
  operator: ConditionOperator,
  expected: string | undefined,
): boolean {
  const value = expected ?? "";
  switch (operator) {
    case "equals":
      return actual === value;
    case "not_equals":
      return actual !== value;
    case "contains":
      return actual.includes(value);
    case "not_contains":
      return !actual.includes(value);
    case "exists":
      return actual.length > 0;
    case "not_exists":
      return actual.length === 0;
    case "matches":
      try {
        return new RegExp(value).test(actual);
      } catch {
        return false;
      }
  }
}

async function visibleLocator(
  page: Page,
  selectors: Selector[],
): Promise<{ locator: Locator; selector: Selector } | null> {
  for (const selector of selectors) {
    const locator = toLocator(page, selector).first();
    if ((await locator.count()) === 0) continue;
    if (await locator.isVisible().catch(() => false)) return { locator, selector };
  }
  return null;
}

async function readText(locator: Locator): Promise<string> {
  const inner = await locator.innerText({ timeout: 5000 }).catch(() => "");
  const text = inner || (await locator.textContent({ timeout: 5000 }).catch(() => "")) || "";
  return text.replace(/\s+/g, " ").trim();
}

export async function evaluateCondition(
  condition: Condition,
  options: { page: Page; outputs: Record<string, unknown>; timeout: number },
): Promise<boolean> {
  const { page, outputs, timeout } = options;
  const target = condition.target;

  if (target.kind === "url") {
    return matchConditionValue(page.url(), condition.operator, condition.value);
  }

  if (target.kind === "output") {
    const value = outputs[target.key];
    const actual = value === undefined || value === null ? "" : String(value);
    return matchConditionValue(actual, condition.operator, condition.value);
  }

  if (condition.operator === "exists" || condition.operator === "not_exists") {
    const found = await visibleLocator(page, target.selectors);
    return condition.operator === "exists" ? Boolean(found) : !found;
  }

  const { locator } = await resolveLocator(page, target.selectors, timeout, () => undefined);
  let actual: string;
  if (target.kind === "value") {
    actual = await locator.inputValue({ timeout });
  } else if (target.kind === "attribute") {
    actual = (await locator.getAttribute(target.attribute, { timeout })) ?? "";
  } else {
    actual = await readText(locator);
  }

  return matchConditionValue(actual, condition.operator, condition.value);
}
