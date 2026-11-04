export function toolbarInitScript() {
  type ToolbarWindow = Window & {
    __webtomateToolbarInstalled?: boolean;
    __webtomatePickMode?: boolean;
    __webtomateCapture?: (payload: unknown) => void;
    __webtomateSelectorsFor?: (el: Element) => unknown[];
    __webtomateNameOf?: (el: Element) => string;
    __webtomateInferAuto?: (el: Element) => { scope: Element; root: unknown } | null;
    __webtomateDetectSections?: () => { el: Element; label: string; kind: string }[];
    __webtomateRemove?: (selectionId: string) => void;
  };

  type Selection = { id: number; clientId: string; label: string; kind: "data" | "value"; payload: unknown };
  type Candidate = { el: Element; box: HTMLDivElement; tag: HTMLButtonElement };

  const w = window as ToolbarWindow;
  if (w.__webtomateToolbarInstalled && document.querySelector("[data-webtomate-ui]")) return;
  if (window.top !== window) return;
  if (!w.__webtomateSelectorsFor) return;
  w.__webtomateToolbarInstalled = true;

  const styles = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .panel { position: fixed; top: 12px; right: 12px; width: 296px; max-width: calc(100vw - 24px);
      pointer-events: auto; font-family: ui-sans-serif, system-ui, sans-serif; color: #18181b; background: #fff;
      border: 1px solid #d4d4d8; border-radius: 12px; box-shadow: 0 18px 48px rgba(0,0,0,.22);
      font-size: 12px; overflow-y: auto; overflow-x: hidden; max-height: calc(100vh - 24px); z-index: 3; }
    .panel.collapsed { display: none; }
    .fab { position: fixed; top: 12px; right: 12px; width: 40px; height: 40px; border-radius: 999px;
      border: 1px solid rgba(255,255,255,.28); background: #18181b; color: #fff; display: none;
      align-items: center; justify-content: center; font: 700 14px/1 ui-sans-serif, system-ui, sans-serif;
      cursor: pointer; pointer-events: auto; box-shadow: 0 10px 30px rgba(0,0,0,.3); z-index: 3; }
    .fab.show { display: flex; }
    .head { display: flex; align-items: center; gap: 8px; padding: 9px 12px;
      background: #18181b; color: #fff; font-weight: 600; }
    .dot { width: 8px; height: 8px; border-radius: 999px; background: #22c55e; }
    .head .spacer { flex: 1; }
    .head button { pointer-events: auto; border: 0; background: transparent; color: #fff;
      font-size: 15px; cursor: pointer; line-height: 1; padding: 0 2px; }
    .body { padding: 10px; display: grid; gap: 8px; min-width: 0; }
    .body > * { min-width: 0; }
    .pick { width: 100%; border: 0; border-radius: 8px; padding: 9px 10px; background: #18181b;
      color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
    .pick.active { background: #dc2626; }
    .status { color: #52525b; line-height: 1.4; overflow-wrap: anywhere; }
    .status.error { color: #b91c1c; }
    .status.ok { color: #15803d; }
    .selections { display: grid; gap: 6px; min-width: 0; }
    .selections:empty { display: none; }
    .selection { display: flex; align-items: center; gap: 8px; padding: 6px 8px; min-width: 0;
      border: 1px solid #e4e4e7; border-radius: 8px; background: #fafafa; }
    .selection .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;
      white-space: nowrap; font-weight: 500; color: #18181b; }
    .selection .badge { flex: none; font-size: 9px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .05em; color: #52525b; background: #e4e4e7; border-radius: 999px; padding: 2px 7px; }
    .selection .remove { flex: none; width: 20px; height: 20px; border: 0; border-radius: 999px;
      background: transparent; color: #71717a; cursor: pointer; font-size: 15px; line-height: 1;
      display: flex; align-items: center; justify-content: center; padding: 0; }
    .selection .remove:hover { background: #fee2e2; color: #b91c1c; }
    .add { width: 100%; border: 1px dashed #a1a1aa; border-radius: 8px; background: #fff; color: #3f3f46;
      font: inherit; font-weight: 600; padding: 8px 10px; cursor: pointer; }
    .add:hover { background: #f4f4f5; }
    .actions { display: flex; gap: 6px; }
    .actions button { flex: 1; border: 1px solid #d4d4d8; border-radius: 8px; background: #fff;
      padding: 7px 8px; font: inherit; font-weight: 600; cursor: pointer; }
    .actions .done { background: #18181b; color: #fff; border-color: #18181b; }
    .actions button[hidden] { display: none; }
    .highlight { position: fixed; display: none; pointer-events: none; border: 2px solid #2563eb;
      background: rgba(37,99,235,.12); border-radius: 3px; z-index: 2; }
    .highlight .tag { position: absolute; left: -2px; bottom: 100%; padding: 2px 6px;
      background: #2563eb; color: #fff; font: 11px ui-monospace, monospace; white-space: nowrap;
      border-radius: 4px 4px 0 0; max-width: 280px; overflow: hidden; text-overflow: ellipsis; }
    .candidate-layer { position: fixed; inset: 0; pointer-events: none; z-index: 1; }
    .section-box { position: fixed; display: none; pointer-events: none; box-sizing: border-box;
      border: 2px solid #3b82f6; border-radius: 4px; }
    .section-tag { position: fixed; display: none; pointer-events: auto; align-items: center; gap: 4px;
      max-width: min(260px, calc(100vw - 16px)); overflow: hidden; text-overflow: ellipsis;
      white-space: nowrap; padding: 3px 8px;
      border: 0; border-radius: 4px; color: #fff; cursor: pointer; font: 600 11px/1.3 ui-sans-serif,
      system-ui, sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,.28); transition: transform .1s; z-index: 2; }
    .section-tag:hover { transform: translateY(-1px); }
    .toast { position: fixed; top: 62px; right: 12px; pointer-events: none; background: #15803d;
      color: #fff; padding: 7px 11px; border-radius: 8px; font: 12px ui-sans-serif, system-ui, sans-serif;
      box-shadow: 0 8px 24px rgba(0,0,0,.2); opacity: 0; transition: opacity .15s; z-index: 4;
      max-width: calc(100vw - 24px); overflow-wrap: anywhere; }
    .toast.show { opacity: 1; }
  `;

  const host = document.createElement("div");
  host.setAttribute("data-webtomate-ui", "");
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.left = "0";
  host.style.width = "0";
  host.style.height = "0";
  host.style.zIndex = "2147483647";
  host.style.pointerEvents = "none";
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <div class="candidate-layer"></div>
    <div class="panel">
      <div class="head"><span class="dot"></span><span>Webtomate data</span><span class="spacer"></span><button class="min" title="Collapse">−</button></div>
      <div class="body">
        <button class="pick" type="button">Select data</button>
        <div class="status">Click Select data, then click a highlighted section or any element.</div>
        <div class="selections"></div>
        <button class="add" type="button" hidden>+ Add another selection</button>
        <div class="actions"><button class="done" type="button" hidden>Done</button><button class="cancel" type="button" hidden>Cancel</button></div>
      </div>
    </div>
    <button class="fab" type="button" title="Open Webtomate data toolbar">W</button>
    <div class="highlight"><div class="tag"></div></div>
    <div class="toast"></div>
  `;

  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    shadow.adoptedStyleSheets = [sheet];
  } catch {
    const styleElement = document.createElement("style");
    styleElement.textContent = styles;
    shadow.prepend(styleElement);
  }

  function q<T extends Element>(selector: string): T {
    const element = shadow.querySelector(selector);
    if (!element) throw new Error(`Missing toolbar element ${selector}`);
    return element as T;
  }

  const panel = q<HTMLDivElement>(".panel");
  const pickButton = q<HTMLButtonElement>(".pick");
  const status = q<HTMLDivElement>(".status");
  const selectionsEl = q<HTMLDivElement>(".selections");
  const addButton = q<HTMLButtonElement>(".add");
  const doneButton = q<HTMLButtonElement>(".done");
  const cancelButton = q<HTMLButtonElement>(".cancel");
  const highlight = q<HTMLDivElement>(".highlight");
  const highlightTag = q<HTMLDivElement>(".highlight .tag");
  const toast = q<HTMLDivElement>(".toast");
  const minButton = q<HTMLButtonElement>(".min");
  const fab = q<HTMLButtonElement>(".fab");
  const candidateLayer = q<HTMLDivElement>(".candidate-layer");

  let picking = false;
  let selections: Selection[] = [];
  let nextSelectionId = 1;
  let collapsed = false;
  let toastTimer: number | undefined;
  let candidateRefreshTimer: number | undefined;
  let candidateFrame = 0;
  let candidates: Candidate[] = [];

  const PALETTE = ["#f97316", "#3b82f6", "#10b981", "#a855f7", "#ef4444", "#eab308", "#06b6d4", "#ec4899"];

  function setStatus(message: string, tone: "normal" | "ok" | "error" = "normal") {
    status.textContent = message;
    status.className = `status${tone === "normal" ? "" : ` ${tone}`}`;
  }

  function showToast(message: string) {
    toast.textContent = message;
    toast.classList.add("show");
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function isUiNode(node: EventTarget | null): boolean {
    return node instanceof Element && Boolean(node.closest("[data-webtomate-ui]"));
  }

  function hideHighlight() {
    highlight.style.display = "none";
  }

  function showHighlight(el: Element) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
      hideHighlight();
      return;
    }
    highlight.style.display = "block";
    highlight.style.left = `${rect.left}px`;
    highlight.style.top = `${rect.top}px`;
    highlight.style.width = `${rect.width}px`;
    highlight.style.height = `${rect.height}px`;
    const id = el.id ? `#${el.id}` : "";
    const cls = el.classList[0] ? `.${el.classList[0]}` : "";
    const text = ((el as HTMLElement).innerText || "").replace(/\s+/g, " ").trim().slice(0, 60);
    highlightTag.textContent = `${el.tagName.toLowerCase()}${id}${cls}${text ? ` · ${text}` : ""}`;
  }

  function selectorsFor(el: Element): unknown[] {
    return w.__webtomateSelectorsFor?.(el) ?? [];
  }

  function nameOf(el: Element): string {
    return w.__webtomateNameOf?.(el) ?? el.tagName.toLowerCase();
  }

  function elementPayload(el: Element) {
    return { selectors: selectorsFor(el), name: nameOf(el), tag: el.tagName.toLowerCase() };
  }

  function send(payload: unknown, selectionId: string) {
    try {
      w.__webtomateCapture?.({ payload, selectionId });
    } catch {
      setStatus("Could not send the selection to Webtomate.", "error");
    }
  }

  function sendRemove(selectionId: string) {
    try {
      w.__webtomateRemove?.(selectionId);
    } catch {
      // Removing is best-effort.
    }
  }

  function setPickMode(enabled: boolean) {
    w.__webtomatePickMode = enabled;
    pickButton.classList.toggle("active", enabled);
    if (!enabled) hideHighlight();
  }

  function clearCandidates(): void {
    for (const candidate of candidates) {
      candidate.box.remove();
      candidate.tag.remove();
    }
    candidates = [];
    if (candidateFrame) {
      window.cancelAnimationFrame(candidateFrame);
      candidateFrame = 0;
    }
    if (candidateRefreshTimer) {
      window.clearTimeout(candidateRefreshTimer);
      candidateRefreshTimer = undefined;
    }
  }

  function positionCandidates(): void {
    for (const candidate of candidates) {
      const rect = candidate.el.getBoundingClientRect();
      const offscreen =
        !candidate.el.isConnected ||
        rect.width < 1 ||
        rect.height < 1 ||
        rect.bottom <= 0 ||
        rect.right <= 0 ||
        rect.top >= window.innerHeight ||
        rect.left >= window.innerWidth;
      if (offscreen) {
        candidate.box.style.display = "none";
        candidate.tag.style.display = "none";
        continue;
      }

      candidate.box.style.display = "block";
      candidate.box.style.left = `${rect.left}px`;
      candidate.box.style.top = `${rect.top}px`;
      candidate.box.style.width = `${rect.width}px`;
      candidate.box.style.height = `${rect.height}px`;

      const tagTop = rect.top >= 22 ? rect.top - 20 : rect.top + 2;
      candidate.tag.style.display = "inline-flex";
      const tagWidth = candidate.tag.offsetWidth || 0;
      const tagHeight = candidate.tag.offsetHeight || 0;
      candidate.tag.style.left = `${Math.max(2, Math.min(rect.left, window.innerWidth - tagWidth - 4))}px`;
      candidate.tag.style.top = `${Math.max(2, Math.min(tagTop, window.innerHeight - tagHeight - 4))}px`;
    }
  }

  function positionCandidatesSoon(): void {
    if (candidateFrame) return;
    candidateFrame = window.requestAnimationFrame(() => {
      candidateFrame = 0;
      positionCandidates();
    });
  }

  function scheduleCandidateRefresh(): void {
    positionCandidatesSoon();
    if (candidateRefreshTimer) window.clearTimeout(candidateRefreshTimer);
    candidateRefreshTimer = window.setTimeout(() => {
      candidateRefreshTimer = undefined;
      if (!collapsed && picking) renderCandidates();
    }, 160);
  }

  function renderCandidates(): void {
    clearCandidates();
    if (collapsed || !picking) return;

    const sections = w.__webtomateDetectSections?.() ?? [];
    for (const [index, section] of sections.slice(0, 12).entries()) {
      const color = PALETTE[index % PALETTE.length];
      const label = (section.label || "").trim() || nameOf(section.el);

      const box = document.createElement("div");
      box.className = "section-box";
      box.style.borderColor = color;
      box.style.background = `${color}14`;

      const tag = document.createElement("button");
      tag.type = "button";
      tag.className = "section-tag";
      tag.style.background = color;
      tag.textContent = `Select ${label}`;
      tag.title = `Select ${label}`;
      tag.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      tag.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        addSelection(section.el, label);
      });

      candidateLayer.append(box, tag);
      candidates.push({ el: section.el, box, tag });
    }

    positionCandidates();
  }

  function classify(el: Element, label: string): Selection {
    const resolvedLabel = label.trim() || nameOf(el);
    const id = nextSelectionId++;
    const clientId = `capture-${Date.now().toString(36)}-${id}`;
    const inferred = w.__webtomateInferAuto?.(el) ?? null;
    if (inferred) {
      return {
        id,
        clientId,
        label: resolvedLabel,
        kind: "data",
        payload: { kind: "structured", container: elementPayload(inferred.scope), root: inferred.root },
      };
    }
    return {
      id,
      clientId,
      label: resolvedLabel,
      kind: "value",
      payload: { kind: "single", element: elementPayload(el), attribute: "text" },
    };
  }

  function updatePanel(): void {
    selectionsEl.replaceChildren();
    for (const selection of selections) {
      const row = document.createElement("div");
      row.className = "selection";
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = selection.label;
      name.title = selection.label;
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = selection.kind;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove";
      remove.textContent = "×";
      remove.title = "Remove selection";
      remove.addEventListener("click", () => {
        selections = selections.filter((item) => item.id !== selection.id);
        sendRemove(selection.clientId);
        updatePanel();
        if (selections.length === 0) {
          setStatus("Click Select data, then click a highlighted section or any element.");
        } else {
          setStatus(`${selections.length} selection(s) ready. Add another or press Done.`, "ok");
        }
      });
      row.append(name, badge, remove);
      selectionsEl.append(row);
    }

    const hasSelections = selections.length > 0;
    pickButton.hidden = picking || hasSelections;
    addButton.hidden = picking || !hasSelections;
    doneButton.hidden = picking || !hasSelections;
    cancelButton.hidden = picking || !hasSelections;
    if (picking) pickButton.textContent = "Click an element...";
    else pickButton.textContent = "Select data";
  }

  function addSelection(el: Element, label: string): void {
    const selection = classify(el, label);
    selections.push(selection);
    stopPicking();
    send(selection.payload, selection.clientId);
    updatePanel();
    setStatus(`${selections.length} selection(s) ready. Add another or press Done.`, "ok");
    showToast(`Added ${selection.label}`);
  }

  function startPicking(): void {
    picking = true;
    setPickMode(true);
    updatePanel();
    renderCandidates();
    setStatus("Click a highlighted section, or any element on the page.");
  }

  function stopPicking(): void {
    picking = false;
    setPickMode(false);
    clearCandidates();
  }

  function sendAll(): void {
    if (selections.length === 0) return;
    const count = selections.length;
    selections = [];
    stopPicking();
    updatePanel();
    setStatus("Click Select data, then click a highlighted section or any element.");
    showToast(`${count} selection(s) confirmed`);
  }

  function cancelAll(): void {
    for (const selection of selections) sendRemove(selection.clientId);
    selections = [];
    stopPicking();
    updatePanel();
    setStatus("Click Select data, then click a highlighted section or any element.");
    showToast("Selection cancelled");
  }

  function setCollapsed(value: boolean): void {
    collapsed = value;
    panel.classList.toggle("collapsed", value);
    fab.classList.toggle("show", value);
    if (value) clearCandidates();
    else if (picking) renderCandidates();
  }

  function onMouseMove(event: MouseEvent) {
    if (!picking || isUiNode(event.target)) {
      hideHighlight();
      return;
    }
    const el = event.target instanceof Element ? event.target : null;
    if (!el || el === document.documentElement || el === document.body) {
      hideHighlight();
      return;
    }
    showHighlight(el);
  }

  function onMouseDown(event: MouseEvent) {
    if (!picking || isUiNode(event.target)) return;
    const el = event.target instanceof Element ? event.target : null;
    if (!el || el === document.documentElement || el === document.body) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function onClick(event: MouseEvent) {
    if (!picking || isUiNode(event.target)) return;
    const el = event.target instanceof Element ? event.target : null;
    if (!el || el === document.documentElement || el === document.body) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    addSelection(el, "");
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== "Escape" || !picking) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    stopPicking();
    updatePanel();
    setStatus("Click Select data, then click a highlighted section or any element.");
    showToast("Selection cancelled");
  }

  function onScroll() {
    hideHighlight();
    positionCandidatesSoon();
    scheduleCandidateRefresh();
  }

  pickButton.addEventListener("click", () => {
    if (picking) {
      stopPicking();
      updatePanel();
      setStatus(`${selections.length} selection(s) ready. Add another or press Done.`, "ok");
      return;
    }
    startPicking();
  });

  addButton.addEventListener("click", () => startPicking());
  doneButton.addEventListener("click", () => sendAll());
  cancelButton.addEventListener("click", () => cancelAll());
  minButton.addEventListener("click", () => setCollapsed(true));
  fab.addEventListener("click", () => setCollapsed(false));

  let attached = false;

  function attach() {
    if (attached || !document.documentElement) return;
    attached = true;
    document.documentElement.append(host);
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll, { passive: true });
    host.addEventListener("click", (event) => event.stopPropagation());
    host.addEventListener("mousedown", (event) => event.stopPropagation());
  }

  updatePanel();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attach, { once: true });
    window.setTimeout(attach, 1500);
  } else {
    attach();
    window.setTimeout(attach, 1500);
  }
}

export function buildToolbarScript(): string {
  return `(() => {
  const __name = (fn) => fn;
  (${toolbarInitScript.toString()})();
})();`;
}
