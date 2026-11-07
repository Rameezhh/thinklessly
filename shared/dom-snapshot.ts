import type { DomSnapshot } from "./api-match";

/**
 * Self-contained function (no imports) so it can be passed to
 * `page.evaluate`, `locator.evaluate`, or run directly in the live DOM.
 */
export function collectDomSnapshot(root: Element): DomSnapshot {
  const values: string[] = [];
  const seen = new Set<string>();

  function visit(node: Element, depth: number): void {
    if (values.length >= 2000 || depth > 8) return;
    const children = node.children;
    if (children.length === 0) {
      const text = ((node as HTMLElement).innerText || node.textContent || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200);
      if (text.length >= 2 && !seen.has(text)) {
        seen.add(text);
        values.push(text);
      }
      return;
    }
    for (const child of Array.from(children)) {
      if (child.tagName === "SCRIPT" || child.tagName === "STYLE" || child.tagName === "NOSCRIPT") continue;
      visit(child, depth + 1);
    }
  }

  visit(root, 0);

  const headers: string[] = [];
  const tableHeaders = root.querySelectorAll("th, [role='columnheader']");
  for (const cell of Array.from(tableHeaders).slice(0, 40)) {
    const text = ((cell as HTMLElement).innerText || cell.textContent || "").replace(/\s+/g, " ").trim();
    if (text) headers.push(text.slice(0, 120));
  }

  const rows: string[][] = [];
  const rowElements = root.querySelectorAll("tbody tr, [role='row']");
  for (const row of Array.from(rowElements).slice(0, 8)) {
    const cells = Array.from(row.querySelectorAll("td, th, [role='cell'], [role='gridcell']")).slice(0, 24);
    const texts = cells
      .map((cell) => ((cell as HTMLElement).innerText || cell.textContent || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (texts.length > 0) rows.push(texts);
  }

  if (rows.length === 0 && headers.length === 0 && values.length > 0) {
    const items = Array.from(root.children).slice(0, 8);
    for (const item of items) {
      const text = ((item as HTMLElement).innerText || item.textContent || "").replace(/\s+/g, " ").trim();
      if (text) rows.push([text.slice(0, 300)]);
    }
  }

  const headings: string[] = [];
  let node: Element | null = root;
  let depth = 0;
  while (node && depth < 4) {
    const previous = node.previousElementSibling;
    let cursor: Element | null = previous;
    while (cursor) {
      if (/^H[1-6]$/.test(cursor.tagName)) {
        const text = ((cursor as HTMLElement).innerText || "").replace(/\s+/g, " ").trim();
        if (text) headings.push(text.slice(0, 120));
      }
      cursor = cursor.previousElementSibling;
    }
    node = node.parentElement;
    depth += 1;
  }

  const attributes: Record<string, string> = {};
  for (const attribute of Array.from(root.attributes)) {
    if (attribute.name.startsWith("data-") || attribute.name === "role" || attribute.name === "aria-label") {
      attributes[attribute.name] = attribute.value.slice(0, 200);
    }
  }

  return {
    tag: root.tagName.toLowerCase(),
    name: root.getAttribute("aria-label") || root.getAttribute("data-testid") || root.id || "",
    headings,
    headers,
    rows,
    values,
    attributes,
  };
}