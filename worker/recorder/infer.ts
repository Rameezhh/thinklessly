export function inferInitScript() {
  type Field =
    | { kind: "value"; key: string; selector: string; attribute: string }
    | { kind: "object"; key: string; selector?: string; fields: Field[] }
    | { kind: "list"; key: string; selector: string; limit: number; fields: Field[] };

  type Group = { scope: Element; items: Element[]; prototype: Element; selector: string };

  type InferWindow = Window & {
    __webtomateInferAuto?: (el: Element) => { scope: Element; root: Field } | null;
    __webtomateDetectGroup?: (el: Element) => Group | null;
    __webtomateItemSelector?: (scope: Element, items: Element[]) => string;
    __webtomateKeyOf?: (el: Element, fallback: string) => string;
    __webtomateContainerKey?: (el: Element, fallback: string) => string;
    __webtomateRelativeSelector?: (scope: Element, el: Element) => string | null;
  };

  const w = window as InferWindow;
  if (!w.__webtomateRelativeSelector) return;

  const MAX_DEPTH = 4;
  const MAX_FIELDS = 120;
  const skippedTags = new Set(["script", "style", "noscript", "template", "svg", "canvas", "iframe", "link", "meta"]);

  function normalizeKey(value: string, fallback: string): string {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);
    if (!slug) return fallback;
    return /^[a-z]/.test(slug) ? slug : `field_${slug}`;
  }

  function uniqueKey(base: string, used: Set<string>): string {
    const key = normalizeKey(base, "field");
    if (!used.has(key)) return key;
    let suffix = 2;
    while (used.has(`${key}_${suffix}`)) suffix += 1;
    return `${key}_${suffix}`;
  }

  function tagOf(el: Element): string {
    return el.tagName.toLowerCase();
  }

  function stableClass(el: Element): string {
    for (const name of Array.from(el.classList)) {
      if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name) || name.length > 40) continue;
      if (/(^|[-_])(active|selected|open|hover|focus|disabled|hidden|show|visible|loaded)$/i.test(name)) continue;
      if (/[0-9]{3,}/.test(name)) continue;
      return name;
    }
    return "";
  }

  function isHidden(el: Element): boolean {
    const style = getComputedStyle(el);
    return style.display === "none" || style.visibility === "hidden" || style.opacity === "0";
  }

  function isSkipped(el: Element): boolean {
    if (skippedTags.has(tagOf(el))) return true;
    if (el.hasAttribute("data-webtomate-ui") || el.closest("[data-webtomate-ui]")) return true;
    if (el.getAttribute("aria-hidden") === "true") return true;
    return isHidden(el);
  }

  function textOf(el: Element): string {
    return ((el as HTMLElement).innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function keyOf(el: Element, fallback: string): string {
    const attributes = ["data-testid", "id", "name", "aria-label", "alt", "title", "placeholder", "role"];
    for (const name of attributes) {
      const value = el.getAttribute(name);
      if (value && value.trim()) return normalizeKey(value, fallback);
    }
    const className = stableClass(el);
    if (className) return normalizeKey(className, fallback);
    if (/^(h[1-6]|a|button|label|th|td|li|time|p)$/.test(tagOf(el))) {
      const text = textOf(el);
      if (text) return normalizeKey(text.slice(0, 40), fallback);
    }
    return fallback;
  }

  function containerKey(el: Element, fallback: string): string {
    for (const name of ["data-testid", "id", "aria-label", "name", "title"]) {
      const value = el.getAttribute(name);
      if (value && value.trim()) return normalizeKey(value, fallback);
    }
    const className = stableClass(el);
    if (className) return normalizeKey(className, fallback);
    return fallback;
  }

  function signature(el: Element): string {
    const classes = Array.from(el.classList)
      .filter((name) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name))
      .filter((name) => !/(^|[-_])(active|selected|open|hover|focus|disabled|hidden|show|visible|loaded)$/i.test(name))
      .sort();
    return `${tagOf(el)}.${classes.join(".")}`;
  }

  function relative(scope: Element, el: Element): string | null {
    return w.__webtomateRelativeSelector?.(scope, el) ?? null;
  }

  function itemSelector(scope: Element, items: Element[]): string {
    const prototype = items[0];
    if (!prototype) return "";
    const tag = tagOf(prototype);
    const common = Array.from(prototype.classList).filter((name) =>
      items.every((item) => item.classList.contains(name)),
    );
    const stable = common.filter((name) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)).slice(0, 2);
    if (prototype.parentElement === scope) {
      return `:scope > ${tag}${stable.map((name) => `.${CSS.escape(name)}`).join("")}`;
    }
    return `${tag}${stable.map((name) => `.${CSS.escape(name)}`).join("")}`;
  }

  function repeatedGroup(el: Element): Group | null {
    const parent = el.parentElement;
    if (parent) {
      const sig = signature(el);
      const siblings = Array.from(parent.children).filter((child) => signature(child) === sig);
      if (siblings.length >= 2) {
        return { scope: parent, items: siblings, prototype: el, selector: itemSelector(parent, siblings) };
      }
    }

    const groups = new Map<string, Element[]>();
    for (const child of Array.from(el.children)) {
      if (isSkipped(child)) continue;
      const sig = signature(child);
      groups.set(sig, [...(groups.get(sig) ?? []), child]);
    }
    let best: Element[] = [];
    for (const items of groups.values()) {
      if (items.length >= 2 && items.length > best.length) best = items;
    }
    if (best.length >= 2) {
      return { scope: el, items: best, prototype: best[0] ?? el, selector: itemSelector(el, best) };
    }
    return null;
  }

  function tableRows(table: HTMLTableElement) {
    const tbodyRows = Array.from(table.querySelectorAll("tbody tr")) as HTMLTableRowElement[];
    if (tbodyRows.length > 0) return { rows: tbodyRows, selector: "tbody tr" };
    const rows = Array.from(table.querySelectorAll("tr")) as HTMLTableRowElement[];
    const first = rows[0];
    const firstIsHeader = Boolean(first && first.querySelectorAll("th").length > 0 && first.querySelectorAll("td").length === 0);
    return { rows: firstIsHeader ? rows.slice(1) : rows, selector: firstIsHeader ? "tr:not(:first-child)" : "tr" };
  }

  function tablePlan(table: HTMLTableElement): { scope: Element; root: Field } | null {
    const { rows, selector } = tableRows(table);
    const headerRow = table.tHead?.rows[0] ?? null;
    const headerCells = headerRow ? Array.from(headerRow.cells) : [];
    const firstRow = rows[0];
    const count = Math.max(headerCells.length, firstRow?.cells.length ?? 0);
    if (count === 0) return null;

    const used = new Set<string>();
    const fields: Field[] = [];
    for (let index = 0; index < count; index += 1) {
      const header = headerCells[index]?.textContent ?? "";
      fields.push({
        kind: "value",
        key: uniqueKey(header || `column_${index + 1}`, used),
        selector: `:scope > td:nth-child(${index + 1}), :scope > th:nth-child(${index + 1})`,
        attribute: "text",
      });
    }

    return {
      scope: table,
      root: {
        kind: "list",
        key: uniqueKey(containerKey(table, "rows"), new Set()),
        selector,
        limit: 500,
        fields,
      },
    };
  }

  function tableField(scope: Element, table: HTMLTableElement, used: Set<string>): Field | null {
    const info = tablePlan(table);
    if (!info || info.root.kind !== "list") return null;
    const selector = relative(scope, table);
    if (!selector) return null;
    return {
      kind: "list",
      key: uniqueKey(containerKey(table, "rows"), used),
      selector: `${selector} ${info.root.selector}`,
      limit: 500,
      fields: info.root.fields,
    };
  }

  function addElement(
    scope: Element,
    el: Element,
    depth: number,
    state: { count: number },
    used: Set<string>,
  ): Field | null {
    if (isSkipped(el) || state.count >= MAX_FIELDS) return null;
    const selector = relative(scope, el);
    if (!selector) return null;
    const tag = tagOf(el);
    const text = textOf(el);
    const directText = Array.from(el.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (tag === "table") {
      const field = tableField(scope, el as HTMLTableElement, used);
      if (field) state.count += 1;
      return field;
    }

    const onlyElement = el.children.length === 1 ? el.children[0] : null;
    if (
      onlyElement &&
      depth < MAX_DEPTH &&
      !directText &&
      !el.getAttribute("data-testid") &&
      !el.id &&
      !el.getAttribute("aria-label")
    ) {
      return addElement(scope, onlyElement, depth + 1, state, used);
    }

    if (tag === "a" && el.getAttribute("href")) {
      const key = uniqueKey(keyOf(el, "link"), used);
      state.count += 1;
      return {
        kind: "object",
        key,
        selector,
        fields: [
          { kind: "value", key: "text", selector: ":scope", attribute: "text" },
          { kind: "value", key: "href", selector: ":scope", attribute: "href" },
        ],
      };
    }

    if (tag === "img" && (el.getAttribute("src") || el.getAttribute("alt"))) {
      const key = uniqueKey(keyOf(el, "image"), used);
      const fields: Field[] = [];
      if (el.getAttribute("src")) fields.push({ kind: "value", key: "src", selector: ":scope", attribute: "src" });
      if (el.getAttribute("alt")) fields.push({ kind: "value", key: "alt", selector: ":scope", attribute: "alt" });
      state.count += 1;
      return { kind: "object", key, selector, fields };
    }

    if (tag === "input" || tag === "textarea" || tag === "select") {
      const key = uniqueKey(keyOf(el, "value"), used);
      state.count += 1;
      return { kind: "value", key, selector, attribute: "value" };
    }

    if (el.children.length > 0 && depth < MAX_DEPTH) {
      const nested = inferFields(el, depth + 1, state);
      if (nested.length > 0) {
        const key = uniqueKey(keyOf(el, tag === "div" || tag === "span" ? "section" : tag), used);
        state.count += 1;
        return { kind: "object", key, selector, fields: nested };
      }
    }

    if (text) {
      const key = uniqueKey(keyOf(el, tag === "div" || tag === "span" ? "text" : tag), used);
      state.count += 1;
      return { kind: "value", key, selector, attribute: "text" };
    }

    for (const attribute of ["href", "src", "alt", "title", "datetime"]) {
      if (el.getAttribute(attribute)) {
        const key = uniqueKey(keyOf(el, tag), used);
        state.count += 1;
        return { kind: "value", key, selector, attribute };
      }
    }

    return null;
  }

  function inferItemFields(item: Element, depth: number, state: { count: number }): Field[] {
    const fields = inferFields(item, depth, state);
    if (fields.length > 0) return fields;
    return [{ kind: "value", key: "text", selector: ":scope", attribute: "text" }];
  }

  function inferFields(scope: Element, depth: number, state: { count: number }): Field[] {
    if (depth > MAX_DEPTH || state.count >= MAX_FIELDS) return [];
    const fields: Field[] = [];
    const used = new Set<string>();
    const children = Array.from(scope.children);
    const handled = new Set<Element>();

    const groups = new Map<string, Element[]>();
    for (const child of children) {
      if (isSkipped(child)) continue;
      const sig = signature(child);
      groups.set(sig, [...(groups.get(sig) ?? []), child]);
    }

    for (const child of children) {
      if (isSkipped(child) || handled.has(child)) continue;
      const sig = signature(child);
      const group = groups.get(sig) ?? [];
      if (group.length >= 2) {
        for (const item of group) handled.add(item);
        const prototype = group[0] ?? child;
        fields.push({
          kind: "list",
          key: uniqueKey(containerKey(scope, keyOf(prototype, "items")), used),
          selector: itemSelector(scope, group),
          limit: 500,
          fields: inferItemFields(prototype, depth + 1, state),
        });
        state.count += 1;
        continue;
      }

      const field = addElement(scope, child, depth, state, used);
      if (field) fields.push(field);
    }

    return fields;
  }

  function detectGroup(el: Element): Group | null {
    return repeatedGroup(el);
  }

  function inferAuto(el: Element): { scope: Element; root: Field } | null {
    const table = tagOf(el) === "table" ? (el as HTMLTableElement) : el.closest("table");
    if (table) {
      const plan = tablePlan(table as HTMLTableElement);
      if (plan) return plan;
    }

    const group = repeatedGroup(el);
    if (group) {
      return {
        scope: group.scope,
        root: {
          kind: "list",
          key: uniqueKey(containerKey(group.scope, "items"), new Set()),
          selector: group.selector,
          limit: 500,
          fields: inferItemFields(group.prototype, 1, { count: 0 }),
        },
      };
    }

    const state = { count: 0 };
    const fields = inferFields(el, 0, state);
    if (fields.length === 0) {
      return {
        scope: el,
        root: { kind: "value", key: uniqueKey(containerKey(el, "text"), new Set()), selector: ":scope", attribute: "text" },
      };
    }
    return {
      scope: el,
      root: { kind: "object", key: uniqueKey(containerKey(el, "data"), new Set()), fields },
    };
  }

  w.__webtomateInferAuto = inferAuto;
  w.__webtomateDetectGroup = detectGroup;
  w.__webtomateItemSelector = itemSelector;
  w.__webtomateKeyOf = keyOf;
  w.__webtomateContainerKey = containerKey;
}

export function buildInferScript(): string {
  return `(() => {
  const __name = (fn) => fn;
  (${inferInitScript.toString()})();
})();`;
}
