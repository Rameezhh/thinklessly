export function toolbarInitScript() {
  type Field =
    | { kind: "value"; key: string; selector: string; attribute: string }
    | { kind: "object"; key: string; selector?: string; fields: Field[] }
    | { kind: "list"; key: string; selector: string; limit: number; fields: Field[] };

  type Group = { scope: Element; items: Element[]; prototype: Element; selector: string };
  type Mode = "auto" | "single" | "list" | "fields";
  type Stage = "idle" | "pickContainer" | "pickFields";

  type ToolbarWindow = Window & {
    __webtomateToolbarInstalled?: boolean;
    __webtomatePickMode?: boolean;
    __webtomateCapture?: (payload: unknown) => void;
    __webtomateSelectorsFor?: (el: Element) => unknown[];
    __webtomateNameOf?: (el: Element) => string;
    __webtomateRelativeSelector?: (scope: Element, el: Element) => string | null;
    __webtomateInferAuto?: (el: Element) => { scope: Element; root: Field } | null;
    __webtomateDetectGroup?: (el: Element) => Group | null;
    __webtomateKeyOf?: (el: Element, fallback: string) => string;
    __webtomateContainerKey?: (el: Element, fallback: string) => string;
  };

  const w = window as ToolbarWindow;
  if (w.__webtomateToolbarInstalled && document.querySelector("[data-webtomate-ui]")) return;
  if (window.top !== window) return;
  if (!w.__webtomateSelectorsFor) return;
  w.__webtomateToolbarInstalled = true;

  const styles = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .panel { position: fixed; top: 12px; right: 12px; width: 292px; pointer-events: auto;
      font-family: ui-sans-serif, system-ui, sans-serif; color: #18181b; background: #fff;
      border: 1px solid #d4d4d8; border-radius: 12px; box-shadow: 0 18px 48px rgba(0,0,0,.22);
      font-size: 12px; overflow: auto; max-height: calc(100vh - 24px); z-index: 3; }
    .panel.collapsed { display: none; }
    .fab { position: fixed; top: 12px; right: 12px; width: 40px; height: 40px; border-radius: 999px;
      border: 1px solid rgba(255,255,255,.28); background: #18181b; color: #fff; display: none;
      align-items: center; justify-content: center; font: 700 14px/1 ui-sans-serif, system-ui, sans-serif;
      cursor: pointer; pointer-events: auto; box-shadow: 0 10px 30px rgba(0,0,0,.3); z-index: 3; }
    .fab.show { display: flex; }
    .candidate-layer { position: fixed; inset: 0; pointer-events: none; z-index: 1; }
    .candidate-box { position: fixed; display: none; pointer-events: none; box-sizing: border-box;
      border-radius: 3px; }
    .candidate-button { position: fixed; display: none; width: 18px; height: 18px; padding: 0;
      border-radius: 999px; border: 1px solid #fff; color: #fff; align-items: center; justify-content: center;
      font: 700 12px/1 ui-sans-serif, system-ui, sans-serif; cursor: pointer; pointer-events: auto;
      box-shadow: 0 1px 5px rgba(0,0,0,.4); z-index: 2; transition: transform .1s; }
    .candidate-button:hover { transform: scale(1.18); }
    .head { display: flex; align-items: center; gap: 8px; padding: 9px 12px;
      background: #18181b; color: #fff; font-weight: 600; }
    .dot { width: 8px; height: 8px; border-radius: 999px; background: #22c55e; }
    .head .spacer { flex: 1; }
    .head button { pointer-events: auto; border: 0; background: transparent; color: #fff;
      font-size: 15px; cursor: pointer; line-height: 1; padding: 0 2px; }
    .body { padding: 8px 10px 10px; display: grid; gap: 6px; }
    .row { display: flex; align-items: center; gap: 6px; }
    .row label { width: 38px; color: #52525b; font-weight: 500; }
    select, input { font: inherit; color: #18181b; background: #fff; border: 1px solid #d4d4d8;
      border-radius: 6px; padding: 5px 7px; min-width: 0; }
    select { flex: 1; }
    input { flex: 1; }
    .pick { width: 100%; border: 0; border-radius: 7px; padding: 8px 10px; background: #18181b;
      color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
    .pick.active { background: #dc2626; }
    .status { min-height: 28px; color: #52525b; line-height: 1.35; }
    .status.error { color: #b91c1c; }
    .status.ok { color: #15803d; }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; max-height: 74px; overflow: auto; }
    .chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 6px;
      border-radius: 999px; background: #f4f4f5; color: #3f3f46; max-width: 100%; }
    .chip span { max-width: 190px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chip button { border: 0; background: transparent; color: #71717a; cursor: pointer; padding: 0; }
    .actions { display: flex; gap: 6px; }
    .actions button { flex: 1; border: 1px solid #d4d4d8; border-radius: 7px; background: #fff;
      padding: 6px 8px; font: inherit; font-weight: 600; cursor: pointer; }
    .actions .done { background: #18181b; color: #fff; border-color: #18181b; }
    .actions button[hidden] { display: none; }
    .highlight { position: fixed; display: none; pointer-events: none; border: 2px solid #2563eb;
      background: rgba(37,99,235,.12); border-radius: 3px; z-index: 2; }
    .highlight .tag { position: absolute; left: -2px; bottom: 100%; padding: 2px 6px;
      background: #2563eb; color: #fff; font: 11px ui-monospace, monospace; white-space: nowrap;
      border-radius: 4px 4px 0 0; max-width: 280px; overflow: hidden; text-overflow: ellipsis; }
    .highlight.outside { border-color: #dc2626; background: rgba(220,38,38,.1); }
    .highlight.outside .tag { background: #dc2626; }
    .toast { position: fixed; top: 62px; right: 12px; pointer-events: none; background: #15803d;
      color: #fff; padding: 7px 11px; border-radius: 8px; font: 12px ui-sans-serif, system-ui, sans-serif;
      box-shadow: 0 8px 24px rgba(0,0,0,.2); opacity: 0; transition: opacity .15s; z-index: 4; }
    .toast.show { opacity: 1; }
  `;

  const host = document.createElement("div");
  host.setAttribute("data-webtomate-ui", "");
  host.style.position = "fixed";
  host.style.inset = "0";
  host.style.zIndex = "2147483647";
  host.style.pointerEvents = "none";
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <div class="candidate-layer"></div>
    <div class="panel">
      <div class="head"><span class="dot"></span><span>Webtomate data</span><span class="spacer"></span><button class="min" title="Collapse">−</button></div>
      <div class="body">
        <div class="row"><label for="wtm-mode">Mode</label>
          <select id="wtm-mode">
            <option value="auto">Auto JSON</option>
            <option value="single">Single value</option>
            <option value="list">Custom list</option>
            <option value="fields">Custom fields</option>
          </select>
        </div>
        <div class="row attr"><label for="wtm-attr">Value</label>
          <select id="wtm-attr">
            <option value="text">Text</option>
            <option value="href">href</option>
            <option value="src">src</option>
            <option value="value">value</option>
            <option value="custom">Custom…</option>
          </select>
          <input id="wtm-custom" placeholder="attribute" hidden />
        </div>
        <button class="pick" type="button">Select data</button>
        <div class="status">Click Select data, then click any element in the page.</div>
        <div class="chips"></div>
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
  const modeSelect = q<HTMLSelectElement>("#wtm-mode");
  const attrRow = q<HTMLDivElement>(".attr");
  const attrSelect = q<HTMLSelectElement>("#wtm-attr");
  const customAttr = q<HTMLInputElement>("#wtm-custom");
  const pickButton = q<HTMLButtonElement>(".pick");
  const status = q<HTMLDivElement>(".status");
  const chips = q<HTMLDivElement>(".chips");
  const doneButton = q<HTMLButtonElement>(".done");
  const cancelButton = q<HTMLButtonElement>(".cancel");
  const highlight = q<HTMLDivElement>(".highlight");
  const highlightTag = q<HTMLDivElement>(".highlight .tag");
  const toast = q<HTMLDivElement>(".toast");
  const minButton = q<HTMLButtonElement>(".min");
  const fab = q<HTMLButtonElement>(".fab");
  const candidateLayer = q<HTMLDivElement>(".candidate-layer");

  let mode: Mode = "auto";
  let stage: Stage = "idle";
  if (!w.__webtomateInferAuto) {
    const autoOption = modeSelect.querySelector<HTMLOptionElement>('option[value="auto"]');
    if (autoOption) autoOption.disabled = true;
    mode = "single";
    modeSelect.value = "single";
  }
  let container: Element | null = null;
  let group: Group | null = null;
  let draft: { key: string; selector: string; attribute: string }[] = [];
  let collapsed = false;
  let toastTimer: number | undefined;
  let candidateRefreshTimer: number | undefined;
  let candidateFrame = 0;
  let candidates: { el: Element; box: HTMLDivElement; button: HTMLButtonElement; depth: number }[] = [];

  const PALETTE = ["#f97316", "#3b82f6", "#10b981", "#a855f7", "#ef4444", "#eab308", "#06b6d4", "#ec4899"];
  const CONTAINER_SELECTOR =
    "div,section,article,main,header,footer,nav,aside,form,table,ul,ol,[data-testid],[role='region'],[role='group']";
  const FIELD_SELECTOR =
    "div,section,p,span,a,img,input,textarea,select,button,h1,h2,h3,h4,h5,h6,li,td,th,label";

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

  function setPickMode(enabled: boolean) {
    w.__webtomatePickMode = enabled;
    pickButton.classList.toggle("active", enabled);
    if (!enabled) hideHighlight();
  }

  function resetStage() {
    stage = "idle";
    container = null;
    group = null;
    draft = [];
    renderChips();
    clearCandidates();
    setPickMode(false);
    pickButton.textContent = "Select data";
    doneButton.hidden = true;
    cancelButton.hidden = true;
    setStatus("Click Select data, then click any element in the page.");
  }

  function beginPick(nextMode: Mode) {
    mode = nextMode;
    stage = "pickContainer";
    container = null;
    group = null;
    draft = [];
    renderChips();
    setPickMode(true);
    renderCandidates();
    pickButton.textContent = "Click an element…";
    doneButton.hidden = true;
    cancelButton.hidden = true;
    if (mode === "auto") setStatus("Click a table, list, card, section, or any div.");
    else if (mode === "single") setStatus("Click the element whose value you want.");
    else if (mode === "list") setStatus("Click the list container or one of the repeated items.");
    else setStatus("Click the container to extract fields from.");
  }

  function selectedAttribute(): string {
    if (attrSelect.value !== "custom") return attrSelect.value;
    const custom = customAttr.value.trim();
    return custom || "text";
  }

  function syncAttributeInputs() {
    attrRow.hidden = mode === "auto";
    customAttr.hidden = attrSelect.value !== "custom";
  }

  function isUiNode(node: EventTarget | null): boolean {
    return node instanceof Element && Boolean(node.closest("[data-webtomate-ui]"));
  }

  function hideHighlight() {
    highlight.style.display = "none";
    highlight.classList.remove("outside");
  }

  function showHighlight(el: Element, outside = false) {
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
    highlight.classList.toggle("outside", outside);
    const id = el.id ? `#${el.id}` : "";
    const cls = el.classList[0] ? `.${el.classList[0]}` : "";
    const text = ((el as HTMLElement).innerText || "").replace(/\s+/g, " ").trim().slice(0, 60);
    highlightTag.textContent = `${el.tagName.toLowerCase()}${id}${cls}${text ? ` · ${text}` : ""}`;
  }

  function candidateLabel(el: Element): string {
    const id = el.id ? `#${el.id}` : "";
    const cls = el.classList[0] ? `.${el.classList[0]}` : "";
    const text = ((el as HTMLElement).innerText || "").replace(/\s+/g, " ").trim().slice(0, 50);
    return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` · ${text}` : ""}`;
  }

  function candidateDepth(el: Element, root: Element): number {
    let depth = 0;
    let node: Element | null = el;
    while (node && node !== root && depth < 24) {
      depth += 1;
      node = node.parentElement;
    }
    return depth;
  }

  function clearCandidates(): void {
    for (const candidate of candidates) {
      candidate.box.remove();
      candidate.button.remove();
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
        candidate.button.style.display = "none";
        continue;
      }

      candidate.box.style.display = "block";
      candidate.box.style.left = `${rect.left}px`;
      candidate.box.style.top = `${rect.top}px`;
      candidate.box.style.width = `${rect.width}px`;
      candidate.box.style.height = `${rect.height}px`;

      const corner = candidate.depth % 4;
      const inset = Math.floor(candidate.depth / 4) * 14;
      let left = rect.left + 3;
      let top = rect.top + 3;
      if (corner === 1) left = rect.right - 21;
      if (corner === 2) top = rect.bottom - 21;
      if (corner === 3) {
        left = rect.right - 21;
        top = rect.bottom - 21;
      }
      if (corner === 0 || corner === 2) left += inset;
      else left -= inset;
      if (corner === 0 || corner === 1) top += inset;
      else top -= inset;
      left = Math.max(2, Math.min(window.innerWidth - 20, left));
      top = Math.max(2, Math.min(window.innerHeight - 20, top));
      candidate.button.style.left = `${left}px`;
      candidate.button.style.top = `${top}px`;
      candidate.button.style.display = "flex";
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
      if (!collapsed && w.__webtomatePickMode) renderCandidates();
    }, 160);
  }

  function renderCandidates(): void {
    clearCandidates();
    if (collapsed || !w.__webtomatePickMode) return;
    if (stage !== "pickContainer" && stage !== "pickFields") return;

    const root =
      stage === "pickFields" ? (group?.prototype ?? container) : (document.body ?? document.documentElement);
    if (!root) return;

    const selector = stage === "pickFields" ? FIELD_SELECTOR : CONTAINER_SELECTOR;
    const minWidth = stage === "pickFields" ? 18 : 40;
    const minHeight = stage === "pickFields" ? 12 : 24;
    const measured: { el: HTMLElement; rect: DOMRect }[] = [];
    for (const el of root.querySelectorAll<HTMLElement>(selector)) {
      if (el === document.documentElement || el === document.body) continue;
      if (stage === "pickFields" && el === root) continue;
      if (el.closest("[data-webtomate-ui]")) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < minWidth || rect.height < minHeight) continue;
      if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= window.innerHeight || rect.left >= window.innerWidth) {
        continue;
      }
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;
      measured.push({ el, rect });
    }

    measured.sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height);

    for (const [index, { el }] of measured.slice(0, 220).entries()) {
      const depth = candidateDepth(el, root);
      const color = PALETTE[(depth + index) % PALETTE.length];
      const box = document.createElement("div");
      box.className = "candidate-box";
      box.style.border = `2px solid ${color}`;
      box.style.boxShadow = `inset 0 0 0 1px rgba(255,255,255,.3)`;
      box.style.background = `${color}12`;
      box.style.zIndex = String(1 + depth);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "candidate-button";
      button.textContent = "Select";
      button.title = `Select ${candidateLabel(el)}`;
      button.style.background = color;
      button.style.zIndex = String(10 + depth);
      // Add column indicator for table cells
      if (el.tagName.toLowerCase() === "td" || el.tagName.toLowerCase() === "th") {
        const possibleRoot = group?.prototype ?? container ?? document.body ?? document.documentElement;
        const trs = possibleRoot.querySelectorAll("tr");
        if (trs.length > 0) {
          const tds = trs[0].querySelectorAll("td,th");
          if (tds.length > 0) {
            const rowIndex = Array.from(trs).findIndex(tr => tr.contains(el));
            if (rowIndex >= 0 && rowIndex < trs.length) {
              const targetTd = trs[rowIndex].querySelectorAll("td,th")[0];
              if (targetTd) {
                const cellsInRow = trs[rowIndex].querySelectorAll("td,th");
                button.title = `Select row ${rowIndex + 1} of ${cellsInRow.length}`;
              }
            }
          }
        }
      }
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (stage === "pickContainer") handleContainerClick(el);
        else if (stage === "pickFields") handleFieldClick(el);
      });

      candidateLayer.append(box, button);
      candidates.push({ el, box, button, depth });
    }

    positionCandidates();
  }

  function setCollapsed(value: boolean): void {
    collapsed = value;
    panel.classList.toggle("collapsed", value);
    fab.classList.toggle("show", value);
    if (value) clearCandidates();
    else if (w.__webtomatePickMode) renderCandidates();
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

  function send(payload: unknown) {
    try {
      w.__webtomateCapture?.(payload);
    } catch {
      setStatus("Could not send the selection to Webtomate.", "error");
    }
  }

  function uniqueDraftKey(base: string): string {
    const used = new Set(draft.map((field) => field.key));
    const key = base;
    if (!used.has(key)) return key;
    let suffix = 2;
    while (used.has(`${key}_${suffix}`)) suffix += 1;
    return `${key}_${suffix}`;
  }

  function renderChips() {
    chips.replaceChildren();
    for (const [index, field] of draft.entries()) {
      const chip = document.createElement("span");
      chip.className = "chip";
      const label = document.createElement("span");
      label.textContent = `${field.key}${field.attribute === "text" ? "" : ` (${field.attribute})`}`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.title = "Remove field";
      remove.addEventListener("click", () => {
        draft.splice(index, 1);
        renderChips();
        setStatus(`${draft.length} field(s) selected.`);
      });
      chip.append(label, remove);
      chips.append(chip);
    }
  }

  function finishSelection() {
    if (!container || draft.length === 0) {
      setStatus("Click at least one field before finishing.", "error");
      return;
    }
    if (mode === "list" && group) {
      const root: Field = {
        kind: "list",
        key: w.__webtomateContainerKey?.(group.scope, "items") ?? "items",
        selector: group.selector,
        limit: 500,
        fields: draft.map((field) => ({ kind: "value", ...field })),
      };
      send({ kind: "structured", container: elementPayload(group.scope), root });
    } else {
      const root: Field = {
        kind: "object",
        key: w.__webtomateContainerKey?.(container, "data") ?? "data",
        fields: draft.map((field) => ({ kind: "value", ...field })),
      };
      send({ kind: "structured", container: elementPayload(container), root });
    }
    showToast("Selection captured");
    resetStage();
  }

  function handleContainerClick(el: Element) {
    if (mode === "auto") {
      const inferred = w.__webtomateInferAuto?.(el);
      if (!inferred) {
        setStatus("Could not infer data from that element. Try Custom fields.", "error");
        return;
      }
      send({ kind: "structured", container: elementPayload(inferred.scope), root: inferred.root });
      showToast("JSON structure captured");
      resetStage();
      return;
    }

    if (mode === "single") {
      send({ kind: "single", element: elementPayload(el), attribute: selectedAttribute() });
      showToast("Value captured");
      resetStage();
      return;
    }

    if (mode === "list") {
      const detected = w.__webtomateDetectGroup?.(el) ?? null;
      if (!detected) {
        setStatus("No repeated items found. Click the list container or one card.", "error");
        return;
      }
      group = detected;
      container = detected.scope;
      stage = "pickFields";
      setStatus(`Detected ${detected.items.length} item(s). Click fields inside the first item.`);
      pickButton.textContent = "Click a field…";
      doneButton.hidden = false;
      cancelButton.hidden = false;
      renderCandidates();
      return;
    }

    container = el;
    group = null;
    stage = "pickFields";
    setStatus("Click each field to include, then Done.");
    pickButton.textContent = "Click a field…";
    doneButton.hidden = false;
    cancelButton.hidden = false;
    renderCandidates();
  }

  function handleFieldClick(el: Element) {
    const scope = group?.prototype ?? container;
    if (!scope) return;
    if (el !== scope && !scope.contains(el)) {
      setStatus("That element is outside the selected container.", "error");
      return;
    }
    const selector = w.__webtomateRelativeSelector?.(scope, el);
    if (!selector) {
      setStatus("Could not build a selector for that element.", "error");
      return;
    }
    const attribute = selectedAttribute();
    if (draft.some((field) => field.selector === selector && field.attribute === attribute)) {
      setStatus("That field is already selected.", "error");
      return;
    }
    const base = w.__webtomateKeyOf?.(el, "field") ?? "field";
    draft.push({ key: uniqueDraftKey(base), selector, attribute });
    renderChips();
    setStatus(`${draft.length} field(s) selected. Click Done when finished.`, "ok");
  }

  function onMouseMove(event: MouseEvent) {
    if (stage === "idle" || isUiNode(event.target)) {
      hideHighlight();
      return;
    }
    const el = event.target instanceof Element ? event.target : null;
    if (!el || el === document.documentElement || el === document.body) {
      hideHighlight();
      return;
    }
    const scope = group?.prototype ?? container;
    const outside = stage === "pickFields" && Boolean(scope && el !== scope && !scope.contains(el));
    showHighlight(el, outside);
  }

  function onMouseDown(event: MouseEvent) {
    if (stage === "idle" || isUiNode(event.target)) return;
    const el = event.target instanceof Element ? event.target : null;
    if (!el || el === document.documentElement || el === document.body) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }


  function onClick(event: MouseEvent) {
    if (stage === "idle" || isUiNode(event.target)) return;
    const el = event.target instanceof Element ? event.target : null;
    if (!el || el === document.documentElement || el === document.body) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    if (stage === "pickContainer") handleContainerClick(el);
    else handleFieldClick(el);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== "Escape" || stage === "idle") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    resetStage();
    showToast("Selection cancelled");
  }

  function onScroll() {
    hideHighlight();
    positionCandidatesSoon();
    scheduleCandidateRefresh();
  }

  pickButton.addEventListener("click", () => {
    if (stage !== "idle") {
      resetStage();
      return;
    }
    beginPick(modeSelect.value as Mode);
    syncAttributeInputs();
  });

  modeSelect.addEventListener("change", () => {
    mode = modeSelect.value as Mode;
    syncAttributeInputs();
    resetStage();
  });

  attrSelect.addEventListener("change", () => {
    syncAttributeInputs();
  });

  customAttr.addEventListener("keydown", (event) => event.stopPropagation());

  doneButton.addEventListener("click", finishSelection);
  cancelButton.addEventListener("click", () => {
    resetStage();
    showToast("Selection cancelled");
  });

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

  syncAttributeInputs();

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
