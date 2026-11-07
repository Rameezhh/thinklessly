import type { Locator } from "playwright";
import type { ExtractField } from "@shared/definition";
import { patchKeepNames } from "./page-eval";

type PlanField = {
  kind: "value" | "object" | "list";
  key: string;
  selector?: string;
  attribute?: string;
  fields?: PlanField[];
  limit?: number;
  header?: string;
  column?: number;
};

type Plan = {
  root: ExtractField;
  maxItems: number;
  maxText: number;
};

export type StructuredExtractOptions = {
  maxItems?: number;
  maxText?: number;
};

function extractInPage(scope: Element, plan: Plan): unknown {
  function textOf(element: Element): string {
    const text = ((element as HTMLElement).innerText || element.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
    return plan.maxText > 0 ? text.slice(0, plan.maxText) : text;
  }

  function valueOf(scopeElement: Element, field: PlanField): string | null {
    const column = columnTarget(scopeElement, field);
    let target: Element | null = column;
    if (!target) {
      target = scopeElement;
      if (field.selector && field.selector !== ":scope") {
        try {
          target = scopeElement.querySelector(field.selector);
        } catch {
          target = null;
        }
      }
    }
    if (!target) return null;

    const attribute = field.attribute || "text";
    if (attribute === "text") return textOf(target);
    if (attribute === "value") {
      const input = target as HTMLInputElement;
      if (typeof input.value === "string") return input.value.slice(0, plan.maxText);
      return target.getAttribute("value");
    }
    return target.getAttribute(attribute);
  }

  function columnTarget(scopeElement: Element, field: PlanField): Element | null {
    if (field.header) {
      const table = scopeElement.closest("table");
      if (table) {
        const headers = Array.from(table.querySelectorAll("thead th, thead td, tr:first-child th"));
        const wanted = field.header.replace(/\s+/g, " ").trim().toLowerCase();
        const index = headers.findIndex(
          (cell) => (cell.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase() === wanted,
        );
        if (index >= 0) return scopeElement.children.item(index);
      }
    }
    if (typeof field.column === "number") {
      return scopeElement.children.item(field.column);
    }
    return null;
  }

  function fieldsOf(scopeElement: Element, fields: PlanField[]): Record<string, unknown> {
    const output: Record<string, unknown> = {};
    for (const field of fields) {
      output[field.key] = build(scopeElement, field);
    }
    return output;
  }

  function build(scopeElement: Element, field: PlanField): unknown {
    if (field.kind === "value") return valueOf(scopeElement, field);

    if (field.kind === "object") {
      let next = scopeElement;
      if (field.selector && field.selector !== ":scope") {
        try {
          const found = scopeElement.querySelector(field.selector);
          if (!found) return null;
          next = found;
        } catch {
          return null;
        }
      }
      return fieldsOf(next, field.fields ?? []);
    }

    let items: Element[] = [];
    try {
      items = Array.from(scopeElement.querySelectorAll(field.selector ?? ""));
    } catch {
      items = [];
    }
    const limit = Math.min(items.length, field.limit ?? plan.maxItems, plan.maxItems);
    return items.slice(0, limit).map((item) => fieldsOf(item, field.fields ?? []));
  }

  return build(scope, plan.root as PlanField);
}

export async function extractStructured(
  container: Locator,
  root: ExtractField,
  options: StructuredExtractOptions = {},
): Promise<unknown> {
  const plan: Plan = {
    root,
    maxItems: options.maxItems ?? 500,
    maxText: options.maxText ?? 100_000,
  };
  await patchKeepNames(container);
  return container.evaluate(extractInPage, plan);
}
