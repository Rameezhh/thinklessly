import type { Page } from "playwright";
import type { Selector, Step } from "@shared/definition";
import { chooseCandidate, type HealCandidate, type HealHints, type HealKind } from "@shared/heal-score";
import type { LogFn } from "./types";
import type { ResolvedLocator } from "./selectors";

const HEALABLE: Record<string, HealKind> = {
  click: "click",
  fill: "fill",
  select: "select",
  check: "check",
  press: "press",
  upload: "upload",
};

function stepKind(step: Step): HealKind | null {
  return HEALABLE[step.type] ?? null;
}

function hintsFrom(step: Step, selectors: Selector[]): HealHints {
  const kind = stepKind(step) ?? "click";
  const names: string[] = [];
  let role: string | undefined;

  for (const selector of selectors) {
    if (selector.name) names.push(selector.name);
    if (selector.kind === "role") {
      role = selector.value;
      if (selector.name) names.push(selector.name);
      continue;
    }
    if (selector.kind === "xpath") continue;
    if (selector.value && selector.value.length <= 120) names.push(selector.value);
  }

  if ("key" in step && step.key) {
    names.push(step.key === "Enter" ? "submit" : step.key);
  }

  return { kind, names: [...new Set(names)], role };
}

/**
 * Runs in the browser and returns visible interactive candidates.
 *
 * This is a string, not a function, on purpose: tsx/esbuild compiles with
 * `keepNames`, which injects `__name(...)` calls around nested functions. Those
 * helpers are not available in the page, so a serialized function would throw
 * and healing would silently find nothing.
 */
const COLLECT_CANDIDATES_SOURCE = `(() => {
  const query = [
    "button",
    "a",
    "input",
    "select",
    "textarea",
    "[role]",
    "[contenteditable='true']",
    "label",
  ].join(",");

  function escapeId(value) {
    if (globalThis.CSS && CSS.escape) return CSS.escape(value);
    return value.replace(/[^a-zA-Z0-9_-]/g, (char) => "\\\\" + char);
  }

  function escapeAttr(value) {
    return value.replace(/\\\\/g, "\\\\\\\\").replace(/"/g, '\\\\"');
  }

  function buildPath(element) {
    if (element.id) return "#" + escapeId(element.id);
    const attributes = ["data-testid", "data-test", "data-qa", "data-cy"];
    for (const attribute of attributes) {
      const value = element.getAttribute(attribute);
      if (value) return "[" + attribute + '="' + escapeAttr(value) + '"]';
    }

    const parts = [];
    let node = element;
    let depth = 0;
    while (node && depth < 6) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        parts.unshift(part + "#" + escapeId(node.id));
        break;
      }
      const parent = node.parentElement;
      if (parent) {
        const current = node;
        const sameTag = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
        if (sameTag.length > 1) part += ":nth-of-type(" + (sameTag.indexOf(current) + 1) + ")";
      }
      parts.unshift(part);
      node = parent;
      depth += 1;
    }
    return parts.join(" > ");
  }

  const nodes = Array.from(document.querySelectorAll(query)).slice(0, 1200);
  const candidates = [];

  nodes.forEach((element, index) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    if (rect.width <= 1 || rect.height <= 1) return;
    if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") return;
    const html = element;
    const text = (html.innerText || element.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 200);
    const testId =
      element.getAttribute("data-testid") ||
      element.getAttribute("data-test") ||
      element.getAttribute("data-qa") ||
      element.getAttribute("data-cy") ||
      "";
    const className = typeof element.className === "string" ? element.className : "";

    candidates.push({
      index: index,
      tag: element.tagName.toLowerCase(),
      role: element.getAttribute("role") || "",
      text: text,
      ariaLabel: element.getAttribute("aria-label") || "",
      placeholder: element.getAttribute("placeholder") || "",
      name: element.getAttribute("name") || "",
      testId: testId,
      id: element.id || "",
      href: element.getAttribute("href") || "",
      type: element.getAttribute("type") || "",
      classes: className.slice(0, 200),
      path: buildPath(element),
    });
  });

  return candidates;
})()`;

/**
 * Tries to recover a step whose recorded selectors no longer match by scoring
 * visible elements against the recorded labels/names. Returns null when no
 * candidate is confidently better than the others.
 */
export async function healLocator(
  page: Page,
  step: Step,
  log: LogFn,
  stepId?: string,
): Promise<ResolvedLocator | null> {
  const kind = stepKind(step);
  if (!kind) return null;
  const selectors = "selectors" in step && step.selectors ? step.selectors : [];
  const hints = hintsFrom(step, selectors);
  if (hints.names.length === 0) return null;

  const candidates = (await page.evaluate(COLLECT_CANDIDATES_SOURCE).catch(() => [])) as HealCandidate[];
  const minScore = kind === "click" ? 0.5 : 0.6;
  const choice = chooseCandidate(candidates, hints, { minScore, margin: 0.08 });
  if (!choice) return null;

  const locator = page.locator(choice.path).first();
  const visible = await locator
    .waitFor({ state: "visible", timeout: 2000 })
    .then(() => true)
    .catch(() => false);
  if (!visible) return null;

  await log({
    level: "warn",
    message: `Healed ${kind} selector (score ${choice.score.toFixed(2)}): ${choice.path}`,
    stepId,
  });
  return { locator, selector: { kind: "css", value: choice.path } };
}
