import type { ExtractField, Selector } from "@shared/definition";

export type DomExtractOptions = { maxItems?: number; maxText?: number };

type PlanField = {
  kind: "value" | "object" | "list";
  key: string;
  selector?: string;
  attribute?: string;
  fields?: PlanField[];
  limit?: number;
};

type Plan = { root: ExtractField; maxItems: number; maxText: number };

/** Mirrors worker/runner/structured.ts exactly, but runs against a live DOM node. */
export function extractStructuredInDom(
  scope: Element,
  root: ExtractField,
  options: DomExtractOptions = {},
): unknown {
  const plan: Plan = {
    root,
    maxItems: options.maxItems ?? 500,
    maxText: options.maxText ?? 100_000,
  };

  function textOf(element: Element): string {
    const text = ((element as HTMLElement).innerText || element.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
    return plan.maxText > 0 ? text.slice(0, plan.maxText) : text;
  }

  function valueOf(scopeElement: Element, field: PlanField): string | null {
    let target: Element | null = scopeElement;
    if (field.selector && field.selector !== ":scope") {
      try {
        target = scopeElement.querySelector(field.selector);
      } catch {
        target = null;
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

  function fieldsOf(scopeElement: Element, fields: PlanField[]): Record<string, unknown> {
    const output: Record<string, unknown> = {};
    for (const field of fields) output[field.key] = build(scopeElement, field);
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

function escapeCss(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
}

function accessibleName(el: Element): string {
  const aria = el.getAttribute("aria-label");
  if (aria) return aria.trim();
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const target = el.ownerDocument.getElementById(labelledBy);
    if (target) return (target.textContent ?? "").replace(/\s+/g, " ").trim();
  }
  const text = ((el as HTMLElement).innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  return text;
}

function roleSelectorMatch(root: ParentNode, selector: Selector): Element | null {
  const wanted = selector.value.toLowerCase();
  const candidates = root.querySelectorAll(`[role="${escapeCss(selector.value)}"]`);
  const pool: Element[] = candidates.length > 0 ? Array.from(candidates) : implicitRoleCandidates(root, wanted);
  const name = (selector.name ?? "").trim();
  if (!name) return pool[0] ?? null;
  for (const el of pool) {
    if (accessibleName(el) === name) return el;
  }
  return null;
}

function implicitRoleCandidates(root: ParentNode, role: string): Element[] {
  const map: Record<string, string> = {
    button: "button, input[type=submit], input[type=button], input[type=reset]",
    link: "a[href]",
    combobox: "select",
    textbox: "textarea, input:not([type])",
    checkbox: "input[type=checkbox]",
    radio: "input[type=radio]",
    searchbox: "input[type=search]",
  };
  const query = map[role];
  return query ? Array.from(root.querySelectorAll(query)) : [];
}

function labelMatch(root: ParentNode, selector: Selector): Element | null {
  const wanted = selector.value.trim();
  for (const label of Array.from(root.querySelectorAll("label"))) {
    const text = (label.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text !== wanted) continue;
    const control = (label as HTMLLabelElement).control;
    if (control) return control;
    const id = label.getAttribute("for");
    if (id) {
      const found = label.ownerDocument.getElementById(id);
      if (found) return found;
    }
  }
  return null;
}

function findBySelector(root: ParentNode, selector: Selector): Element | null {
  try {
    switch (selector.kind) {
      case "testid":
        return root.querySelector(`[data-testid="${escapeCss(selector.value)}"]`);
      case "css":
        return root.querySelector(selector.value);
      case "placeholder":
        return root.querySelector(`[placeholder="${escapeCss(selector.value)}"]`);
      case "label":
        return labelMatch(root, selector);
      case "role":
        return roleSelectorMatch(root, selector);
      case "text": {
        const wanted = selector.value.trim().toLowerCase();
        for (const el of Array.from(root.querySelectorAll("a, button, [role=button], [role=link]"))) {
          if (accessibleName(el).toLowerCase() === wanted) return el;
        }
        return null;
      }
      case "xpath": {
        const doc = (root as Element).ownerDocument ?? (root as Document);
        const result = doc.evaluate(
          selector.value,
          root as Node,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null,
        );
        return result.singleNodeValue instanceof Element ? result.singleNodeValue : null;
      }
    }
  } catch {
    return null;
  }
}

export function findElementBySelectors(root: ParentNode, selectors: Selector[]): Element | null {
  for (const selector of selectors) {
    const found = findBySelector(root, selector);
    if (found) return found;
  }
  return null;
}

export function readElementAttribute(el: Element, attribute: string): string | null {
  if (attribute === "text") {
    return ((el as HTMLElement).innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  }
  if (attribute === "value") {
    const input = el as HTMLInputElement;
    if (typeof input.value === "string") return input.value;
  }
  return el.getAttribute(attribute);
}
