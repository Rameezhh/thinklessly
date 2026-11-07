export function recorderInitScript() {
  type RecorderWindow = Window & {
    __thinklesslyRecord?: (event: unknown) => void;
    __thinklesslyCapture?: (payload: unknown) => void;
    __thinklesslyRecorderInstalled?: boolean;
    __thinklesslyPickMode?: boolean;
    __thinklesslySelectorsFor?: (el: Element) => unknown[];
    __thinklesslyNameOf?: (el: Element) => string;
    __thinklesslyTextOf?: (el: Element) => string;
    __thinklesslyRelativeSelector?: (scope: Element, el: Element) => string | null;
    __thinklesslyEscape?: (value: string) => string;
    __thinklesslyFlush?: () => void;
    __thinklesslyObstructionDismissing?: boolean;
  };

  const w = window as RecorderWindow;
  if (w.__thinklesslyRecorderInstalled) return;
  w.__thinklesslyRecorderInstalled = true;

  function send(payload: unknown) {
    try {
      w.__thinklesslyRecord?.(payload);
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

  const strongToLogical = new Map<string, string>();
  const passwordWeak = new Map<string, string>();
  const logicalPassword = new Set<string>();
  let logicalCounter = 0;

  function formKeyOf(el: Element): string {
    const form = (el as HTMLInputElement).form;
    if (!form) return "";
    return form.id || form.getAttribute("name") || form.getAttribute("action") || "";
  }

  function fieldPosition(el: Element): string {
    const form = (el as HTMLInputElement).form;
    if (!form) return "";
    const fields = Array.from(form.elements) as Element[];
    const index = fields.indexOf(el);
    return index >= 0 ? String(index) : "";
  }

  /** Identity ignores `type` and `id` so a "show password" swap keeps the same target. */
  function strongKeyOf(el: Element): string {
    const input = el as HTMLInputElement;
    const name = el.getAttribute("name") || input.name || "";
    const main =
      name ||
      el.getAttribute("autocomplete") ||
      labelOf(el) ||
      placeholderOf(el) ||
      el.getAttribute("aria-label") ||
      `pos:${fieldPosition(el)}`;
    return `${el.tagName.toLowerCase()}|${formKeyOf(el)}|${main}`;
  }

  /** Weaker key used only to reconnect password fields whose name changes on reveal. */
  function passwordWeakKeyOf(el: Element): string {
    const main =
      el.getAttribute("autocomplete") ||
      labelOf(el) ||
      placeholderOf(el) ||
      el.getAttribute("aria-label") ||
      "";
    return main ? `${formKeyOf(el)}|${main}` : "";
  }

  function logicalIdentityOf(el: Element): string {
    const strong = strongKeyOf(el);
    let id = strongToLogical.get(strong);
    if (!id) {
      const weak = passwordWeakKeyOf(el);
      if (weak) id = passwordWeak.get(weak);
    }
    if (!id) {
      logicalCounter += 1;
      id = `t${logicalCounter}:${strong}`;
    }
    strongToLogical.set(strong, id);

    const tag = el.tagName.toLowerCase();
    const type = tag === "input" ? ((el as HTMLInputElement).type || "").toLowerCase() : "";
    if (type === "password") {
      logicalPassword.add(id);
      const weak = passwordWeakKeyOf(el);
      if (weak) passwordWeak.set(weak, id);
    }
    return id.slice(0, 300);
  }

  function isSecretField(el: Element, identity: string): boolean {
    const tag = el.tagName.toLowerCase();
    if (tag !== "input") return false;
    const type = ((el as HTMLInputElement).type || "text").toLowerCase();
    return type === "password" || logicalPassword.has(identity);
  }

  function markPasswordFields(root: ParentNode = document): void {
    for (const input of Array.from(root.querySelectorAll('input[type="password"]'))) {
      logicalIdentityOf(input);
    }
  }

  let passwordScanTimer: ReturnType<typeof setTimeout> | undefined;

  function schedulePasswordScan(): void {
    if (passwordScanTimer) return;
    passwordScanTimer = setTimeout(() => {
      passwordScanTimer = undefined;
      markPasswordFields();
    }, 100);
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
      if (className) part += `.${escapeValue(className)}`;

      const parent: Element | null = current.parentElement;
      if (parent) {
        const sameTag = Array.from(parent.children).filter((child: Element) => child.tagName === current.tagName);
        const ambiguous = className
          ? sameTag.filter((child: Element) => child.classList.contains(className)).length > 1
          : sameTag.length > 1;
        if (ambiguous) part += `:nth-of-type(${sameTag.indexOf(current) + 1})`;
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
      .some((node) => node instanceof Element && node.hasAttribute("data-thinklessly-ui"));
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
    const identity = logicalIdentityOf(el);
    return {
      selectors: selectorsFor(el),
      name: nameOf(el),
      tag: el.tagName.toLowerCase(),
      inputType: el.tagName.toLowerCase() === "input" ? ((el as HTMLInputElement).type || "text").toLowerCase() : "",
      fieldKey: fieldKeyOf(el),
      identity,
    };
  }

  const pendingTimers = new Map<Element, ReturnType<typeof setTimeout>>();
  const dirtyFields = new Set<Element>();

  function fillPayload(el: Element): Record<string, unknown> | null {
    const tag = el.tagName.toLowerCase();
    const identity = logicalIdentityOf(el);
    if (tag === "textarea") {
      return {
        kind: "fill",
        element: elementInfo(el),
        value: (el as HTMLTextAreaElement).value,
        secret: false,
      };
    }
    if (tag !== "input") return null;
    const input = el as HTMLInputElement;
    const type = (input.type || "text").toLowerCase();
    if (type === "checkbox" || type === "radio" || type === "file") return null;
    if (type === "submit" || type === "button" || type === "reset") return null;
    const secret = isSecretField(el, identity);
    return {
      kind: "fill",
      element: elementInfo(el),
      value: secret ? "" : input.value,
      secret,
    };
  }

  function sendFill(el: Element): void {
    const payload = fillPayload(el);
    if (payload) send(payload);
  }

  function clearPending(el: Element): boolean {
    const timer = pendingTimers.get(el);
    if (timer === undefined) return false;
    clearTimeout(timer);
    pendingTimers.delete(el);
    return true;
  }

  function scheduleFill(el: Element): void {
    dirtyFields.add(el);
    clearPending(el);
    const timer = setTimeout(() => {
      pendingTimers.delete(el);
      dirtyFields.delete(el);
      sendFill(el);
    }, 400);
    pendingTimers.set(el, timer);
  }

  function flushElement(el: Element, force = false): void {
    const hadPending = clearPending(el);
    const wasDirty = dirtyFields.delete(el);
    if (!hadPending && !wasDirty && !force) return;
    sendFill(el);
  }

  function flushAll(): void {
    for (const el of Array.from(pendingTimers.keys())) {
      if (el.isConnected) flushElement(el);
      else {
        clearPending(el);
        dirtyFields.delete(el);
      }
    }
    for (const el of Array.from(dirtyFields)) {
      if (el.isConnected) flushElement(el);
      else dirtyFields.delete(el);
    }
  }

  function handleClick(event: MouseEvent) {
    if (w.__thinklesslyPickMode || w.__thinklesslyObstructionDismissing || isUiEvent(event)) return;
    const el = resolveTarget(event.target);
    if (!el || (el as HTMLButtonElement).disabled) return;

    const tag = el.tagName.toLowerCase();
    const type = tag === "input" ? ((el as HTMLInputElement).type || "text").toLowerCase() : "";
    if (tag === "input" && type !== "submit" && type !== "button" && type !== "reset") return;
    if (tag === "select" || tag === "textarea") return;

    send({ kind: "click", element: elementInfo(el) });
  }

  function handleInput(event: Event) {
    if (w.__thinklesslyPickMode || w.__thinklesslyObstructionDismissing || isUiEvent(event)) return;
    const el = resolveTarget(event.target);
    if (!el) return;
    const tag = el.tagName.toLowerCase();
    if (tag !== "input" && tag !== "textarea") return;
    if (tag === "input") {
      const type = ((el as HTMLInputElement).type || "text").toLowerCase();
      if (type === "checkbox" || type === "radio" || type === "file") return;
      if (type === "submit" || type === "button" || type === "reset") return;
    }
    scheduleFill(el);
  }

  function handleChange(event: Event) {
    if (w.__thinklesslyPickMode || w.__thinklesslyObstructionDismissing || isUiEvent(event)) return;
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
      flushElement(el, true);
      return;
    }

    if (tag === "textarea") flushElement(el, true);
  }

  function handleFocusOut(event: FocusEvent) {
    if (w.__thinklesslyPickMode || isUiEvent(event)) return;
    const el = resolveTarget(event.target);
    if (el) flushElement(el);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (w.__thinklesslyPickMode || isUiEvent(event)) return;
    if (event.key !== "Enter" || event.repeat) return;
    const el = resolveTarget(event.target);
    if (!el) return;
    const tag = el.tagName.toLowerCase();
    if (tag !== "input" && tag !== "textarea") return;
    send({ kind: "press", element: elementInfo(el), key: "Enter" });
  }

  w.__thinklesslySelectorsFor = selectorsFor;
  w.__thinklesslyNameOf = nameOf;
  w.__thinklesslyTextOf = textOf;
  w.__thinklesslyRelativeSelector = relativeSelector;
  w.__thinklesslyEscape = escapeValue;
  w.__thinklesslyFlush = flushAll;

  function attach() {
    markPasswordFields();
    document.addEventListener("click", handleClick, true);
    document.addEventListener("input", handleInput, true);
    document.addEventListener("change", handleChange, true);
    document.addEventListener("focusout", handleFocusOut, true);
    document.addEventListener("focusin", schedulePasswordScan, true);
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("pagehide", flushAll);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushAll();
    });
    if (typeof MutationObserver !== "undefined" && document.documentElement) {
      const observer = new MutationObserver(schedulePasswordScan);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
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
