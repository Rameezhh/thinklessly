import type { Locator } from "playwright";
import {
  CHALLENGE_SELECTORS,
  isDangerousLabel,
  looksLikeChallenge,
  normalizeLabel,
} from "@shared/obstructions";
import type { Control } from "./obstruction-types";

export type OverlayShape = {
  width: number;
  height: number;
  position: string;
  zIndex: number;
  display: string;
  visibility: string;
  opacity: string;
  text: string;
  buttons: number;
  vw: number;
  vh: number;
};

export async function isVisible(target: Locator): Promise<boolean> {
  return target.isVisible().catch(() => false);
}

export async function shapeOf(target: Locator): Promise<OverlayShape | null> {
  return target
    .evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const text = ((el as HTMLElement).innerText || el.textContent || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 3000);
      const buttons = el.querySelectorAll(
        "button, a, [role='button'], input[type='submit'], input[type='button']",
      ).length;
      return {
        width: rect.width,
        height: rect.height,
        position: style.position,
        zIndex: Number.parseInt(style.zIndex || "0", 10) || 0,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        text,
        buttons,
        vw: window.innerWidth,
        vh: window.innerHeight,
      };
    })
    .catch(() => null);
}

export function isOverlayLike(shape: OverlayShape | null, strong: boolean): boolean {
  if (!shape) return false;
  if (shape.display === "none" || shape.visibility === "hidden" || shape.opacity === "0") return false;
  if (shape.width < 120 || shape.height < 40) return false;
  if (strong) return true;
  const cover = (shape.width * shape.height) / Math.max(1, shape.vw * shape.vh);
  const floating =
    shape.position === "fixed" ||
    shape.position === "absolute" ||
    (shape.position === "sticky" && shape.zIndex >= 50) ||
    shape.zIndex >= 50;
  return floating && cover >= 0.02 && shape.buttons > 0;
}

export async function overlayText(overlay: Locator): Promise<string> {
  return overlay
    .evaluate((el) =>
      ((el as HTMLElement).innerText || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 4000),
    )
    .catch(() => "");
}

export async function overlayChallenge(overlay: Locator): Promise<string | null> {
  const selector = await overlay
    .evaluate((el, selectors) => {
      for (const candidate of selectors) {
        try {
          if (el.matches(candidate) || el.querySelector(candidate)) return candidate;
        } catch {
          // Invalid selector; ignore.
        }
      }
      return null;
    }, CHALLENGE_SELECTORS)
    .catch(() => null);
  if (selector) return "Human verification required";
  const text = await overlayText(overlay);
  return looksLikeChallenge(text) ? "Human verification required" : null;
}

export async function clickOnce(target: Locator, timeout = 1500): Promise<boolean> {
  if (!(await isVisible(target))) return false;
  try {
    await target.click({ timeout });
    return true;
  } catch {
    // Intercepted or detached; fall back to a DOM click which still runs the
    // site's own handler in almost all implementations.
    return target
      .evaluate((el) => {
        (el as HTMLElement).click();
        return true;
      })
      .catch(() => false);
  }
}

export async function overlayControls(overlay: Locator): Promise<Control[]> {
  const controls = overlay.locator(
    "button, a, [role='button'], input[type='submit'], input[type='button']",
  );
  const count = Math.min(await controls.count().catch(() => 0), 80);
  const output: Control[] = [];

  for (let index = 0; index < count; index += 1) {
    const locator = controls.nth(index);
    if (!(await isVisible(locator))) continue;
    const label = await locator
      .evaluate((el) => {
        const input = el as HTMLInputElement;
        return ((el as HTMLElement).innerText ||
          input.value ||
          el.getAttribute("aria-label") ||
          el.getAttribute("title") ||
          "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 120);
      })
      .catch(() => "");
    if (label) output.push({ locator, label });
  }
  return output;
}

export function pickControl(controls: Control[], labels: string[]): Control | null {
  const safe = controls.filter((control) => !isDangerousLabel(control.label));
  for (const label of labels) {
    const wanted = normalizeLabel(label);
    const exact = safe.find((control) => normalizeLabel(control.label) === wanted);
    if (exact) return exact;
  }
  for (const label of labels) {
    const wanted = normalizeLabel(label);
    if (wanted.length < 4) continue;
    const partial = safe.find((control) => normalizeLabel(control.label).includes(wanted));
    if (partial) return partial;
  }
  return null;
}