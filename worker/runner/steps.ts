import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Locator } from "playwright";
import type { CheckValue, FillValue, Selector, SelectValue, Step } from "@shared/definition";
import { resolveLocator } from "./selectors";
import { extractStructured } from "./structured";
import { blockedFromStatus, detectBlocked, type BlockedInfo } from "./blocked";
import type { StepContext } from "./types";

export type StepOutcome = { blocked?: BlockedInfo };

const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

export function resolveInputValue(key: string, ctx: StepContext): { value: string; secret: boolean } {
  const field = ctx.definition.fields.find((item) => item.key === key);

  if (hasOwn(ctx.secrets, key)) {
    return { value: String(ctx.secrets[key] ?? ""), secret: true };
  }
  if (hasOwn(ctx.inputs, key)) {
    const raw = ctx.inputs[key];
    if (raw !== "" && raw !== null && raw !== undefined) {
      return { value: String(raw), secret: field?.secret ?? false };
    }
  }
  if (field?.defaultValue !== undefined) {
    return { value: String(field.defaultValue), secret: field.secret };
  }
  if (field?.required) {
    throw new Error(`Missing required input "${key}"`);
  }
  return { value: "", secret: field?.secret ?? false };
}

function resolveTextValue(value: FillValue | SelectValue | string, ctx: StepContext): string {
  if (typeof value === "string") return value;
  if (value.mode === "literal") return value.text;
  return resolveInputValue(value.key, ctx).value;
}

function resolveCheckedValue(value: CheckValue, ctx: StepContext): boolean {
  if (typeof value === "boolean") return value;
  const raw = resolveInputValue(value.key, ctx).value.toLowerCase();
  return raw === "true" || raw === "on" || raw === "1" || raw === "yes";
}

async function readText(locator: Locator): Promise<string> {
  const inner = await locator.innerText({ timeout: 5000 }).catch(() => "");
  if (inner) return inner;
  return (await locator.textContent({ timeout: 5000 })) ?? "";
}

export async function executeStep(step: Step, ctx: StepContext): Promise<StepOutcome> {
  const page = ctx.page;
  const log = (level: "info" | "warn" | "error", message: string) => ctx.log(level, message, step.id);
  const resolve = (selectors: Selector[]) =>
    resolveLocator(
      page,
      selectors,
      ctx.timeout,
      (entry) => ctx.log(entry.level, entry.message, entry.stepId ?? step.id),
      step.id,
    );

  switch (step.type) {
    case "goto": {
      const response = await page.goto(step.url, { waitUntil: "domcontentloaded", timeout: ctx.timeout });
      await log("info", `Navigated to ${step.url}`);
      const statusReason = blockedFromStatus(response?.status());
      if (statusReason) return { blocked: { blocked: true, reason: statusReason } };
      return { blocked: await detectBlocked(page) };
    }

    case "click": {
      const { locator, selector } = await resolve(step.selectors);
      await locator.click({ timeout: ctx.timeout });
      await log("info", `Clicked using ${selector.kind} selector`);
      await page.waitForTimeout(300);
      return { blocked: await detectBlocked(page) };
    }

    case "fill": {
      const { locator } = await resolve(step.selectors);
      if (step.value.mode === "literal") {
        await locator.fill(step.value.text, { timeout: ctx.timeout });
        await log("info", "Filled literal value");
      } else {
        const { value, secret } = resolveInputValue(step.value.key, ctx);
        await locator.fill(value, { timeout: ctx.timeout });
        await log("info", `Filled field "${step.value.key}" with ${secret ? "***" : "input value"}`);
      }
      break;
    }

    case "select": {
      const { locator } = await resolve(step.selectors);
      const value = resolveTextValue(step.value, ctx);
      await locator.selectOption(value, { timeout: ctx.timeout });
      await log("info", "Selected option");
      break;
    }

    case "check": {
      const { locator } = await resolve(step.selectors);
      const checked = resolveCheckedValue(step.checked, ctx);
      if (checked) {
        await locator.check({ timeout: ctx.timeout });
      } else {
        await locator.uncheck({ timeout: ctx.timeout });
      }
      await log("info", `Checkbox set to ${checked}`);
      break;
    }

    case "upload": {
      const { locator } = await resolve(step.selectors);
      const raw = ctx.inputs[step.fieldKey];
      if (typeof raw !== "string" || raw.length === 0) {
        throw new Error(`Missing upload path for field "${step.fieldKey}"`);
      }
      const info = await stat(raw).catch(() => null);
      if (!info?.isFile()) {
        throw new Error(`Upload path for field "${step.fieldKey}" is not a file`);
      }
      await locator.setInputFiles(raw, { timeout: ctx.timeout });
      await log("info", `Uploaded file for field "${step.fieldKey}"`);
      break;
    }

    case "press": {
      if (step.selectors) {
        const { locator } = await resolve(step.selectors);
        await locator.press(step.key, { timeout: ctx.timeout });
      } else {
        await page.keyboard.press(step.key);
      }
      await log("info", `Pressed key ${step.key}`);
      break;
    }

    case "wait": {
      if (step.kind === "ms") {
        const ms = Number(step.value);
        if (!Number.isFinite(ms) || ms < 0) throw new Error("Wait value must be a non-negative number of milliseconds");
        await page.waitForTimeout(ms);
      } else if (step.kind === "selector") {
        await page.locator(String(step.value)).first().waitFor({ state: "visible", timeout: ctx.timeout });
      } else if (step.kind === "url") {
        await page.waitForURL(String(step.value), { timeout: ctx.timeout });
      } else {
        await page.waitForLoadState("networkidle", { timeout: ctx.timeout });
      }
      await log("info", `Waited (${step.kind})`);
      break;
    }

    case "extract": {
      const { locator } = await resolve(step.selectors);
      let value: string | null;
      if (step.attribute === "text") {
        value = await readText(locator);
      } else if (step.attribute === "value") {
        value = await locator.inputValue({ timeout: ctx.timeout });
      } else {
        value = await locator.getAttribute(step.attribute, { timeout: ctx.timeout });
      }
      ctx.outputs[step.outputKey] = value;
      await log("info", `Extracted "${step.outputKey}"`);
      break;
    }

    case "extractStructured": {
      const { locator } = await resolve(step.selectors);
      ctx.outputs[step.root.key] = await extractStructured(locator, step.root);
      await log("info", `Extracted structured data into "${step.root.key}"`);
      break;
    }

    case "screenshot": {
      await mkdir(ctx.runDir, { recursive: true });
      const path = join(ctx.runDir, step.name);
      await page.screenshot({ path, fullPage: step.fullPage, timeout: ctx.timeout });
      ctx.artifacts.push({ kind: "SCREENSHOT", path, name: step.name });
      await log("info", `Screenshot saved as ${step.name}`);
      break;
    }

    case "assert": {
      if (step.kind === "visible") {
        await resolve(step.selectors ?? []);
      } else if (step.kind === "text") {
        const { locator } = await resolve(step.selectors ?? []);
        const text = await readText(locator);
        if (!text.includes(step.value ?? "")) {
          throw new Error(`Assertion failed: text does not include "${step.value ?? ""}"`);
        }
      } else {
        if (!page.url().includes(step.value ?? "")) {
          throw new Error(`Assertion failed: URL "${page.url()}" does not include "${step.value ?? ""}"`);
        }
      }
      await log("info", `Assertion passed (${step.kind})`);
      break;
    }
  }

  return {};
}
