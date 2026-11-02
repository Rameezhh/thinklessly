export function recorderInitScript() {
  type RecorderWindow = Window & {
    __webtomateRecord?: (event: unknown) => void;
    __webtomateCapture?: (payload: unknown) => void;
    __webtomateRecorderInstalled?: boolean;
    __webtomatePickMode?: boolean;
    __webtomateSelectorsFor?: (el: Element) => unknown[];
    __webtomateNameOf?: (el: Element) => string;
    __webtomateTextOf?: (el: Element) => string;
    __webtomateRelativeSelector?: (scope: Element, el: Element) => string | null;
    __webtomateEscape?: (value: string) => string;
  };

  const w = window as RecorderWindow;
  if (w.__webtomateRecorderInstalled) return;
  w.__webtomateRecorderInstalled = true;

  function send(payload: unknown) {
    try {
      w.__webtomateRecord?.(payload);
    } catch {
      // Ignore binding failures while the page is unloading.
    }
  }

  function escapeValue(value: string): string {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
    return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
  }

  function attr(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function textOf(el: Element): string {
    const text = (el as HTMLElement).innerText || el.textContent || "";
    return text.replace(/\s+/g, " ").trim().slice(0, 80);
  }

  function labelOf(el: Element): string {
    const input = el as HTMLInputElement;
    if (input.labels && input.labels.length > 0) {
      const text = textOf(input.labels[0]);
      if (text) return text;
    }
    const aria = el.getAttribute("aria-label");
    if (aria) return aria.trim();
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const target = document.getElementById(labelledBy);
      const text = target ? textOf(target) : "";
      if (text) return text;
    }
    return "";
  }

  function placeholderOf(el: Element): string {
    return (el as HTMLInputElement).placeholder?.trim() ?? "";
  }

  function nameOf(el: Element): string {
    return labelOf(el) || placeholderOf(el) || textOf(el) || el.getAttribute("name") || el.id || el.tagName.toLowerCase();
  }

  function fieldKeyOf(el: Element): string {
    const raw = el.getAttribute("name") || el.id || labelOf(el) || placeholderOf(el) || "";
    const key = raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);
    return /^[a-z]/.test(key) ? key : "";
  }

  function roleOf(el: Element): string | null {
    const explicit = el.getAttribute("role");
    if (explicit) return explicit.split(" ")[0] ?? null;
    const tag = el.tagName.toLowerCase();
    if (tag === "button") return "button";
    if (tag === "a" && el.getAttribute("href")) return "link";
    if (tag === "select") return "combobox";
    if (tag === "textarea") return "textbox";
    if (tag === "input") {
      const type = ((el as HTMLInputElement).type || "text").toLowerCase();
      if (type === "submit" || type === "reset" || type === "button") return "button";
      if (type === "checkbox" || type === "radio") return type;
      if (type === "search") return "searchbox";
      return "textbox";
    }
    return null;
  }

  function cssPath(el: Element): string {
    const parts: string[] = [];
    let node: Element | null = el;
    let depth = 0;

    while (node && node.nodeType === 1 && depth < 6) {
      const current: Element = node;
      const tag = current.tagName.toLowerCase();
      if (current.id) {
        parts.unshift(`#${escapeValue(current.id)}`);
        break;
      }
      const testId = current.getAttribute("data-testid");
      if (testId) {
        parts.unshift(`${tag}[data-testid="${attr(testId)}"]`);
        break;
      }
      const name = current.getAttribute("name");
      if (name) {
        parts.unshift(`${tag}[name="${attr(name)}"]`);
        break;
      }
      let part = tag;
      const parent: Element | null = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((child: Element) => child.tagName === current.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
      parts.unshift(part);
      node = parent;
      depth += 1;
    }

    return parts.join(" > ");
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

  function relativeSelector(scope: Element, el: Element): string | null {
    if (el === scope) return ":scope";
    const parts: string[] = [];
    let node: Element | null = el;
    let depth = 0;

    while (node && node !== scope && depth < 8) {
      const current: Element = node;
      const tag = current.tagName.toLowerCase();
      if (current.id) {
        parts.unshift(`#${escapeValue(current.id)}`);
        break;
      }
      const testId = current.getAttribute("data-testid");
      if (testId) {
        parts.unshift(`${tag}[data-testid="${attr(testId)}"]`);
        break;
      }
      const name = current.getAttribute("name");
      if (name) {
        parts.unshift(`${tag}[name="${attr(name)}"]`);
        break;
      }
      const className = stableClass(current);
      let part = tag;
      if (className) {
        part += `.${escapeValue(className)}`;
      } else {
        const parent: Element | null = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter((child: Element) => child.tagName === current.tagName);
          if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
      }
      parts.unshift(part);
      node = current.parentElement;
      depth += 1;
    }

    if (node !== scope || parts.length === 0) return null;
    return `:scope > ${parts.join(" > ")}`;
  }

  function isUiEvent(event: Event): boolean {
    return event
      .composedPath()
      .some((node) => node instanceof Element && node.hasAttribute("data-webtomate-ui"));
  }

  function selectorsFor(el: Element): unknown[] {
    const selectors: unknown[] = [];
    const seen = new Set<string>();
    const add = (selector: { kind: string; value: string; name?: string }) => {
      const signature = `${selector.kind}:${selector.value}:${selector.name ?? ""}`;
      if (!selector.value || seen.has(signature)) return;
      seen.add(signature);
      selectors.push(selector);
    };

    const testId = el.getAttribute("data-testid");
    if (testId) add({ kind: "testid", value: testId });
    if (el.id) add({ kind: "css", value: `#${escapeValue(el.id)}` });
    const label = labelOf(el);
    if (label) add({ kind: "label", value: label });
    const placeholder = placeholderOf(el);
    if (placeholder) add({ kind: "placeholder", value: placeholder });
    const role = roleOf(el);
    if (role) {
      const name = nameOf(el);
      if (name) add({ kind: "role", value: role, name });
    }
    const tag = el.tagName.toLowerCase();
    if (tag === "button" || tag === "a") {
      const text = textOf(el);
      if (text && text.length <= 60) add({ kind: "text", value: text });
    }
    const path = cssPath(el);
    if (path) add({ kind: "css", value: path });

    return selectors;
  }

  function resolveTarget(node: EventTarget | null): Element | null {
    if (!(node instanceof Element)) return null;
    const direct = node.closest(
      'button, a[href], input, select, textarea, [data-testid], [onclick], [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"]',
    );
    if (direct) return direct;
    const label = node.closest("label");
    if (label && label.control) return label.control;
    return null;
  }

  function elementInfo(el: Element) {
    return {
      selectors: selectorsFor(el),
      name: nameOf(el),
      tag: el.tagName.toLowerCase(),
      inputType: el.tagName.toLowerCase() === "input" ? ((el as HTMLInputElement).type || "text").toLowerCase() : "",
      fieldKey: fieldKeyOf(el),
    };
  }

  function handleClick(event: MouseEvent) {
    if (w.__webtomatePickMode || isUiEvent(event)) return;
    const el = resolveTarget(event.target);
    if (!el || (el as HTMLButtonElement).disabled) return;

    const tag = el.tagName.toLowerCase();
    const type = tag === "input" ? ((el as HTMLInputElement).type || "text").toLowerCase() : "";
    if (tag === "input" && type !== "submit" && type !== "button" && type !== "reset") return;
    if (tag === "select" || tag === "textarea") return;

    send({ kind: "click", element: elementInfo(el) });
  }

  function handleChange(event: Event) {
    if (w.__webtomatePickMode || isUiEvent(event)) return;
    const el = resolveTarget(event.target);
    if (!el) return;
    const tag = el.tagName.toLowerCase();

    if (tag === "select") {
      send({ kind: "select", element: elementInfo(el), value: (el as HTMLSelectElement).value });
      return;
    }

    if (tag === "input") {
      const input = el as HTMLInputElement;
      const type = (input.type || "text").toLowerCase();
      if (type === "checkbox" || type === "radio") {
        send({ kind: "check", element: elementInfo(el), checked: input.checked });
        return;
      }
      if (type === "file") {
        if (input.files && input.files.length > 0) send({ kind: "upload", element: elementInfo(el) });
        return;
      }
      if (type === "submit" || type === "button" || type === "reset") return;
      const secret = type === "password";
      send({
        kind: "fill",
        element: elementInfo(el),
        value: secret ? "" : input.value,
        secret,
      });
      return;
    }

    if (tag === "textarea") {
      send({ kind: "fill", element: elementInfo(el), value: (el as HTMLTextAreaElement).value, secret: false });
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (w.__webtomatePickMode || isUiEvent(event)) return;
    if (event.key !== "Enter" || event.repeat) return;
    const el = resolveTarget(event.target);
    if (!el) return;
    const tag = el.tagName.toLowerCase();
    if (tag !== "input" && tag !== "textarea") return;
    send({ kind: "press", element: elementInfo(el), key: "Enter" });
  }

  w.__webtomateSelectorsFor = selectorsFor;
  w.__webtomateNameOf = nameOf;
  w.__webtomateTextOf = textOf;
  w.__webtomateRelativeSelector = relativeSelector;
  w.__webtomateEscape = escapeValue;

  function attach() {
    document.addEventListener("click", handleClick, true);
    document.addEventListener("change", handleChange, true);
    document.addEventListener("keydown", handleKeyDown, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attach, { once: true });
  } else {
    attach();
  }
}

export function buildRecorderScript(): string {
  return `(() => {
  const __name = (fn) => fn;
  (${recorderInitScript.toString()})();
})();`;
}

export const RECORDER_SCRIPT = buildRecorderScript();
