import type { Frame, Page } from "playwright";
import { OVERLAY_MATCHERS, classifyOverlayText } from "@shared/obstructions";
import { isOverlayLike, isVisible, shapeOf } from "./obstruction-helpers";
import type { Overlay } from "./obstruction-types";
import { patchKeepNames } from "./page-eval";

export async function findKnownOverlay(scope: Page | Frame): Promise<Overlay | null> {
  for (const matcher of OVERLAY_MATCHERS) {
    const nodes = scope.locator(matcher.selector);
    const count = Math.min(await nodes.count().catch(() => 0), 6);
    const strong =
      matcher.selector.trim().startsWith("#") ||
      /role\s*=|aria-modal/.test(matcher.selector);
    for (let index = 0; index < count; index += 1) {
      const candidate = nodes.nth(index);
      if (!(await isVisible(candidate))) continue;
      const shape = await shapeOf(candidate);
      if (!isOverlayLike(shape, strong)) continue;
      const kind = shape?.text ? classifyOverlayText(shape.text) : matcher.kind;
      return { locator: candidate, kind: matcher.kind === "modal" ? kind : matcher.kind };
    }
  }
  return null;
}

/**
 * Finds the top-most floating layer even when it has no known class/id. This is
 * the wide safety net for custom interstitials. The code runs inside the page
 * after `patchKeepNames` so esbuild's `__name` helpers do not break it.
 */
export async function findFloatingOverlay(scope: Page | Frame): Promise<Overlay | null> {
  await patchKeepNames(scope);
  const found = await scope
    .evaluate(() => {
      function pathFor(element: Element): string {
        if (element.id) return `#${CSS.escape(element.id)}`;
        const testId = element.getAttribute("data-testid");
        if (testId) return `${element.tagName.toLowerCase()}[data-testid="${testId.replace(/"/g, '\\"')}"]`;

        const parts: string[] = [];
        let node: Element | null = element;
        let depth = 0;
        while (node && depth < 5) {
          let part = node.tagName.toLowerCase();
          const parent: Element | null = node.parentElement;
          if (parent) {
            const current: Element = node;
            const same = Array.from(parent.children).filter(
              (child: Element) => child.tagName === current.tagName,
            );
            if (same.length > 1) part += `:nth-of-type(${same.indexOf(current) + 1})`;
          }
          parts.unshift(part);
          node = parent;
          depth += 1;
        }
        return parts.join(" > ");
      }

      const points: Array<[number, number]> = [];
      for (const fx of [0.25, 0.5, 0.75]) {
        for (const fy of [0.25, 0.5, 0.75]) {
          points.push([window.innerWidth * fx, window.innerHeight * fy]);
        }
      }

      for (const [x, y] of points) {
        for (const element of document.elementsFromPoint(x, y)) {
          if (element === document.documentElement || element === document.body) continue;
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          if (style.display === "none" || style.visibility === "hidden") continue;
          if (Number.parseFloat(style.opacity || "1") === 0) continue;
          const cover = (rect.width * rect.height) / Math.max(1, window.innerWidth * window.innerHeight);
          const zIndex = Number.parseInt(style.zIndex || "0", 10) || 0;
          const floating = style.position === "fixed" || zIndex >= 100;
          if (!floating || cover < 0.015) continue;
          if (!element.querySelector("button, a, [role='button'], input[type='submit']")) continue;
          const text = ((element as HTMLElement).innerText || element.textContent || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 3000);
          return { path: pathFor(element), text };
        }
      }
      return null;
    })
    .catch(() => null);

  if (!found) return null;
  const locator = scope.locator(found.path).first();
  if (!(await isVisible(locator))) return null;
  return { locator, kind: classifyOverlayText(found.text) };
}