export function sectionsInitScript() {
  type DetectedGroup = { scope: Element; items: Element[]; prototype: Element; selector: string };
  type Section = { el: Element; label: string; kind: "table" | "form" | "list" | "object" };

  type SectionsWindow = Window & {
    __thinklesslyDetectSections?: () => Section[];
    __thinklesslyDetectGroup?: (el: Element) => DetectedGroup | null;
  };

  const w = window as SectionsWindow;
  if (!w.__thinklesslyDetectGroup) return;
  if (w.__thinklesslyDetectSections) return;

  const MAX_SECTIONS = 12;
  const GROUP_LIMIT = 400;
  const skippedTags = new Set(["script", "style", "noscript", "template", "svg", "canvas", "iframe", "link", "meta"]);

  function tagOf(el: Element): string {
    return el.tagName.toLowerCase();
  }

  function isHidden(el: Element): boolean {
    const style = getComputedStyle(el);
    return style.display === "none" || style.visibility === "hidden" || style.opacity === "0";
  }

  function isSkipped(el: Element): boolean {
    if (skippedTags.has(tagOf(el))) return true;
    if (el.hasAttribute("data-thinklessly-ui") || el.closest("[data-thinklessly-ui]")) return true;
    if (el.getAttribute("aria-hidden") === "true") return true;
    return isHidden(el);
  }

  function textOf(el: Element): string {
    return ((el as HTMLElement).innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function labelOf(el: Element): string {
    let node: Element | null = el;
    let depth = 0;
    while (node && depth < 4) {
      let previous = node.previousElementSibling;
      while (previous) {
        if (/^h[1-6]$/.test(tagOf(previous))) {
          const text = textOf(previous);
          if (text) return text.slice(0, 60);
        }
        previous = previous.previousElementSibling;
      }
      node = node.parentElement;
      depth += 1;
    }

    const inner = el.querySelector("caption, legend, summary, h1, h2, h3");
    if (inner) {
      const text = textOf(inner);
      if (text) return text.slice(0, 60);
    }

    for (const name of ["aria-label", "data-testid", "id", "name", "title"]) {
      const value = el.getAttribute(name);
      if (value && value.trim()) return value.trim().slice(0, 60);
    }

    const text = textOf(el);
    return text ? text.slice(0, 60) : tagOf(el);
  }

  function documentOrder(a: Element, b: Element): number {
    if (a === b) return 0;
    const position = a.compareDocumentPosition(b);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  }

  function detect(): Section[] {
    const root = document.body ?? document.documentElement;
    if (!root) return [];

    const found = new Map<Element, Section["kind"]>();

    function add(el: Element, kind: Section["kind"]): void {
      if (found.has(el) || found.size >= 60) return;
      found.set(el, kind);
    }

    function measuredArea(el: Element): { width: number; height: number; area: number } {
      const rect = el.getBoundingClientRect();
      return { width: rect.width, height: rect.height, area: rect.width * rect.height };
    }

    for (const el of root.querySelectorAll("table, form")) {
      if (isSkipped(el)) continue;
      const size = measuredArea(el);
      if (size.width < 80 || size.height < 30) continue;
      add(el, tagOf(el) === "form" ? "form" : "table");
    }

    for (const el of root.querySelectorAll("section, article, [role='region'], [role='group'], [data-testid], main > *")) {
      if (found.has(el) || isSkipped(el)) continue;
      const size = measuredArea(el);
      if (size.width < 120 || size.height < 40 || size.area < 2000) continue;
      add(el, "object");
    }

    let scanned = 0;
    for (const el of root.querySelectorAll(
      "ul, ol, [role='list'], [role='grid'], [role='listbox'], [class*='card'], [class*='grid'], [class*='list'], [class*='items'], [class*='products']",
    )) {
      if (scanned >= GROUP_LIMIT) break;
      scanned += 1;
      if (found.has(el) || isSkipped(el) || el.children.length < 2) continue;
      const group = w.__thinklesslyDetectGroup?.(el) ?? null;
      if (!group || group.items.length < 2) continue;
      const size = measuredArea(group.scope);
      if (size.width < 80 || size.height < 24) continue;
      add(group.scope, "list");
    }

    const ordered = Array.from(found.entries())
      .map(([el, kind]) => ({ el, kind }))
      .sort((a, b) => documentOrder(a.el, b.el));

    const specific = ordered.filter((section) => section.kind !== "object");
    const generic = ordered.filter((section) => section.kind === "object");

    const genericWithoutSpecific = generic.filter(
      (section) => !specific.some((child) => section.el.contains(child.el)),
    );
    const topLevelGeneric = genericWithoutSpecific.filter(
      (section) =>
        !genericWithoutSpecific.some((other) => other.el !== section.el && other.el.contains(section.el)),
    );

    const selected = [...topLevelGeneric, ...specific].sort((a, b) => documentOrder(a.el, b.el));

    return selected.slice(0, MAX_SECTIONS).map(({ el, kind }) => ({ el, label: labelOf(el), kind }));
  }

  w.__thinklesslyDetectSections = detect;
}

export function buildSectionsScript(): string {
  return `(() => {
  const __name = (fn) => fn;
  (${sectionsInitScript.toString()})();
})();`;
}
