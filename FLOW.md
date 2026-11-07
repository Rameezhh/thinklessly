# FLOW.md — Live Session / Recorder (current behaviour)

This document describes how the automation recorder (the "live session") works
today, before the service-worker proxy rework. Everything below runs on one
developer machine; the recording browser is a **server-side headful Chromium**.

## 1. Entry and setup

- Route: `/dashboard/automations/create` (`src/app/dashboard/automations/create/page.tsx`).
  Server component calls `requireUser()`, reads `RECORDER_PORT` (default `4001`),
  and renders `<RecorderPanel recorderPort>`.
- `src/components/automations/recorder-panel.tsx` lets the user set:
  - **name** of the automation,
  - **starting URL**,
  - **captureData** toggle (default on).
- "Start recording" sends `POST http://127.0.0.1:4001/sessions` with
  `{ startUrl, captureData }`.

## 2. Session start (worker + Playwright)

- `worker/recorder/server.ts` validates the body with Zod (`startSchema`),
  enforces `RECORDER_MAX_SESSIONS` (default `1`), creates a `RecorderSession`
  (`worker/recorder/session.ts`), and returns `{ sessionId }`.
- `RecorderSession.start()`:
  - launches **headful Chromium** (`chromium.launch({ headless: false })`,
    `viewport: null`),
  - registers Playwright bindings: `__thinklesslyRecord` (always),
    `__thinklesslyCapture` and `__thinklesslyRemove` (when `captureData`),
  - injects init scripts: `buildRecorderScript()` always, plus
    `buildInferScript()`, `buildSectionsScript()`, `buildToolbarScript()` when
    `captureData`,
  - opens `startUrl`, pushes a `goto` step, and sets status to `recording`.

## 3. Toolbar overlay (`worker/recorder/toolbar.ts`)

Injected into the target page (only when `window.top === window`) as a
closed-shadow-DOM host carrying `[data-thinklessly-ui]`. It renders:

- a floating "Thinklessly data" panel top-right, collapsible to a round FAB,
- a hover highlight box with a tag describing the hovered element,
- coloured, labelled candidate boxes over detected sections,
- a toast for feedback.

"Select data" turns on **pick mode**:

- `mousemove` highlights the element under the cursor,
- `renderCandidates()` calls `__thinklesslyDetectSections()` and draws clickable
  boxes over detected tables / forms / lists / objects,
- clicking a candidate or any element calls `classify()`:
  - `__thinklesslyInferAuto(el)` returns a plan → payload
    `{ kind: "structured", container, root }`,
  - otherwise → payload `{ kind: "single", element, attribute: "text" }`.
- The payload is sent via `__thinklesslyCapture({ payload, selectionId })`.
- The selections list shows `single`/`data` badges, supports remove, "Add
  another selection", "Done" (confirm) and "Cancel" (sends `__thinklesslyRemove`).

## 4. Selector + action tracking (`worker/recorder/script.ts`)

- `selectorsFor(el)` builds an ordered candidate list:
  `testid → css #id → label → placeholder → role+name → text → css path`.
  This matches `selectorSchema` in `shared/definition.ts`
  (`testid | role | label | placeholder | text | css | xpath`).
- Also exposes `nameOf`, `fieldKeyOf`, `roleOf`, `relativeSelector`
  (used by infer for nested/list fields), `stableClass`, `cssPath`.
- Capture-phase listeners on `click`, `change`, `keydown`:
  - click → `{ kind: "click", element }` (buttons / submit only),
  - change → `select` / `check` / `upload` / `fill`
    (password inputs send `secret: true` and a blank value),
  - Enter → `{ kind: "press", key: "Enter" }`.
- Every event is sent via `__thinklesslyRecord(payload)`.

## 5. Server-side step building (`worker/recorder/session.ts`)

- `handleEvent()` validates with `eventSchema` and builds steps in
  `buildEventStep()`:
  - click → `{ type: "click", selectors, label, optional }`,
  - fill secret → creates/reuses a `password` **Field**, step value
    `{ mode: "field", key }`; literal → `{ mode: "literal", text }`,
  - select / check / upload / press similarly; upload creates a `file` Field.
- Steps are merged with `mergeRecordedStep()` (one value step per element),
  capped at **250 steps**, and broadcast as `step` / `step-updated`.
- `handleCapture()` validates via `capturePayloadSchema` (`capture.ts`) →
  `buildCaptureStep()` produces an `extract` or `extractStructured` step with a
  unique output key. For `extractStructured` it resolves the container in
  Playwright and runs `extractStructured()` to broadcast a live JSON `preview`
  (max 500 items).
- Navigation: `framenavigated` (main frame) is debounced 500 ms and records an
  extra `goto` step, suppressed for 5 s after a user interaction. Popups are
  tracked through `context.on("page")`.

## 6. Transport

WebSocket `ws://127.0.0.1:4001/sessions/:id/ws`. On connect the server sends a
`snapshot` (status, startUrl, captureData, fields, steps, previews,
previewTotals). Then: `step`, `step-updated`, `preview`, `capture-error`,
`stopped`. The client also polls `GET /sessions/:id` every 1.5 s as a fallback.

## 7. Stop and save

- "End automation" → `POST /sessions/:id/stop`. The worker blurs the active
  element, records the final navigation, closes Chromium, runs
  `autoPayloadFields(fields, steps)`, and returns the snapshot.
- The client builds `definitionJson`:
  `{ version: 1, startUrl, fields, steps, settings: { stepTimeoutMs: 15000, runTimeoutMs: 300000, allowHumanHelp: true } }`
  and submits the existing `importAutomationAction`
  (`src/lib/automation-actions.ts`), which runs `parseDefinition` and creates
  `Automation` + `AutomationVersion` v1.

## 8. Security today

The recorder HTTP/WS server binds `127.0.0.1`, rejects non-local origins (403),
caps bodies at 1 MB, and validates all input with Zod. **Execution** is a
separate Playwright runner (`worker/runner/*`) that reads the same step/selector
schema; selectors resolve through Playwright's
`getByTestId / getByRole / getByLabel / getByPlaceholder / getByText / locator`.

## 9. Stable input capture

- The injected recorder now computes a semantic `identity` for each control
  (`form + name/autocomplete/label/placeholder`, ignoring `id` and `type`).
  Steps persist it as `identity` in the definition.
- `mergeRecordedStep` merges by `identity` first (falling back to selectors).
  A credential step (`secret: true`) is never downgraded to a literal, so a
  "show password" toggle cannot record a second field or expose the value.
- Text inputs send debounced `input` events (400 ms) and flush on `change`,
  `focusout`, `pagehide`, and visibility change. The last committed value wins.
  `__thinklesslyFlush()` is called when a recording stops.
- Password/file inputs create/reuse one `Field` per identity, not per selector.

## 10. API tracking and extraction

### Capture

- Browser live mode: `public/live/sw.js` listens to Scramjet's `request` and
  `handleResponse` events, tees JSON response bodies (≤ 2 MB), redacts auth
  headers, and broadcasts entries over a `BroadcastChannel`
  (`thinklessly-network`) plus `client.postMessage`. `LiveRecorderSession`
  stores them and decodes proxied URLs when needed.
- Playwright recorder and runner: `worker/network/collector.ts` records
  responses (method, URL, status, safe headers, request body, parsed JSON body)
  for up to 300 entries. The recorder attaches it before the first `goto`.
- Nothing from the network log is persisted in the database; only the chosen
  endpoint metadata is stored in the step.

### Live session runtime (`/live`)

- The target site runs inside an iframe proxied by Scramjet (`/live/proxy/...`)
  with a service worker (`/live/sw.js`) and the local Wisp relay
  (`WISP_PORT`, default `4002`). `NEXT_PUBLIC_WISP_URL` is used on HTTP; on an
  HTTPS page a `ws://` value would be mixed content, so `defaultWispUrl` falls
  back to same-origin `wss://<host>/live/wisp/` (the `pnpm sim` proxy).
- Service workers need a secure context. Use `http://localhost:3000` (or the
  HTTPS sim at `https://localhost:8443`); opening the app from a LAN/IP address
  shows an explicit error instead of a blank frame.
- `sw.js` calls `skipWaiting()` on install and `clients.claim()` on activate,
  and registration uses `updateViaCache: "none"` + `registration.update()`, so
  a proxy update never stays stuck in "waiting".
- The recorder bundle is injected on load, on every `urlchange`, and re-checked
  every 1.2 s. The recorder and toolbar scripts guard against double installs;
  after an SPA soft navigation the toolbar re-attaches its existing host
  (`__thinklesslyToolbarAttach`) instead of adding duplicate listeners. This is
  what keeps recording alive on Amazon-style client-side navigation.
- Proxy failures and human checks show a **non-blocking top banner** (Retry,
  Reset proxy, Dismiss, Close, End automation), so the site underneath stays
  interactive. **Reset proxy** unregisters the `/live/` worker, clears
  live/Scramjet caches and BareMux state, then reloads.
- The injected live bundle includes `worker/recorder/auto-dismiss.ts`: it closes
  benign consent/newsletter/region/age overlays (never a human check) and flags
  its clicks with `__thinklesslyObstructionDismissing` so they are not saved as
  steps.
- Root layout sets `suppressHydrationWarning` so browser-extension attributes
  (e.g. ColorZilla's `cz-shortcut-listen`) do not trigger the dev hydration
  overlay over the live tab.

### Matching a selection to an API

- The toolbar sends the DOM selection. The session builds a DOM snapshot
  (`shared/dom-snapshot.ts`: headers, first rows, leaf text, nearby headings).
- `shared/api-match.ts` scores every captured JSON response by value overlap,
  key overlap, row fit, and recency, and returns ranked candidates. The best
  candidate above `0.5` becomes an `extractApi` step; otherwise the existing
  DOM `extractStructured` step is used.
- Each column is mapped to an API key. Columns the API does not contain are
  marked `source: "dom"` and read from the corresponding DOM row at run time.
  API rows and DOM rows are aligned with a detected `joinKey` or by index.

### The `extractApi` step

- Stores the endpoint (`request`), stable match (`method`, `pathname`, stable
  query params), JSON path, shape, field map, limit, DOM container/fallback.
- At run time (`worker/runner/api.ts`) it tries, in order:
  1. **passive** — read the page's own matching response (keeps cookies, CSRF
     tokens and signatures correct),
  2. **replay** — `fetch` from the page context with `credentials: "include"`,
  3. **DOM fallback** — the recorded `extractStructured` tree.
- `shared/api-extract.ts` shapes the JSON: current rows, current response keys
  when they are renamed, nested objects flattened to `parent_child`, empty
  values/keys dropped, duplicate keys suffixed. Output is the list/object
  directly (no envelope layering).

### Deterministic output normalization

- At record time `buildApiCaptureStep` builds a `NormalizePlan` from the first
  captured response and stores it on the step (`extractApi.outputSchema`).
  `shared/normalize/*` derives canonical keys from a fixed dictionary
  (`product_title` → `title`, `price_value` → `price`, ...), stable types
  (`string | number | currency | boolean | date | url | array | object`), key
  order and aliases. No model or API key is involved.
- The record preview (`worker/recorder/api-capture.ts`, `src/lib/live/session.ts`)
  runs `normalizeWithPlan` with the same plan, so the review panel shows exactly
  what later runs will produce.
- Every run calls `normalizeWithPlan` in `worker/runner/api.ts` (API, observed
  or replayed, and the DOM fallback). New or renamed keys fall through
  `canonicalKey`; unknown keys are preserved rather than dropped.
- `Run.meta` (nullable JSON string, set by `worker/index.ts`) records the output
  schema summary per output key: source (`api`/`html`), endpoint, method,
  entity, row count, canonical columns, and whether the plan was applied.
  `serializeRun`, the run API/webhook, `worker/run-file.ts` and the run detail
  page expose it. `outputs` itself stays the clean normalized value.

## 11. Run hardening

- `worker/browser/launch.ts` opens Chromium with `--disable-blink-features=
  AutomationControlled`, a small stealth init script, and a persistent profile
  (`BROWSER_PROFILE_DIR`, default `data/profiles`). Runs use
  `data/profiles/<automationId>`; the recorder uses `data/profiles/recorder`.
  This keeps cookies/logins between runs (important for Amazon/marketplaces).
- Set `BROWSER_PROFILE_DIR=""` to disable persistent profiles.
- **Ad blocking** is opt-in and offline at run time. `pnpm adblock:fetch` writes
  EasyList + EasyPrivacy to `data/adblock/list.txt`; `launch.ts` parses that
  cached file with `PlaywrightBlocker` and enables it for every page. If the
  file is missing the run continues without blocking. Set
  `ADBLOCK_DISABLED=true` to turn it off or `ADBLOCK_LIST_PATH` to use another
  file.
- **Obstructions (wide coverage)** — `shared/obstructions.ts` is a deterministic
  catalog of consent managers (OneTrust, Cookiebot, TrustArc, Quantcast, Osano,
  Usercentrics, Didomi, Klaro, HubSpot), Amazon popovers/sign-in/location
  prompts, newsletter/app/age/region/login overlays, and generic
  dialog/modal/popup/interstitial containers. `worker/runner/obstruction.ts`
  runs before every step and:
  1. finds known containers, then a top-most floating layer using
     `elementsFromPoint` grid sampling (custom interstitials with no known
     class/id);
  2. prefers a structural close/dismiss control, then safe labels
     (`reject all`, `no thanks`, `not now`, `maybe later`, `continue shopping`,
     `close`, `×`, ...);
  3. allows `continue`/`enter`/region+age answers **only inside** a recognized
     overlay;
  4. never clicks dangerous labels (`pay`, `place order`, `buy`, `delete`,
     `unsubscribe`, `sign out`, `submit`, ...);
  5. falls back to Escape, then hides only consent/newsletter/app banners that
     have no usable control and no password field.
  Native alert/confirm/beforeunload dialogs are handled by
  `registerDialogHandler` (alerts/confirms dismissed, beforeunload accepted).
- **Human checks are never auto-solved.** `shared/obstructions.ts` also owns the
  CAPTCHA/bot-check signatures (reCAPTCHA, hCaptcha, Turnstile, Arkose,
  Cloudflare, `#captchacharacters`, "Enter the characters you see", "unusual
  traffic", ...). `worker/runner/blocked.ts` detects visible challenges and the
  runner returns `NEEDS_HUMAN` with a clear reason instead of clicking. The live
  page shows a non-blocking banner so the user can finish the check directly in
  the page while recording continues.
- **Settings** — `settings.resilience` (`autoDismiss`, `allowContinue`,
  `allowAcceptConsent`; defaults `true`, `true`, `false`). Missing values fall
  back to safe defaults via `resilienceSettings()`.
- **Step criticality** — `stepCriticality` classifies every step as `required`,
  `preferred` or `optional`. Clicks and presses are `preferred` by default, so
  a stale "recommendations" button is skipped with a warning instead of failing
  the run. Inputs, selects, checks, uploads, URLs (`goto`) and extractions are
  `required`. The recorder writes `criticality` on every step; the review/detail
  UI has a "Required step" toggle. A failed step first retries once after
  clearing an obstruction, and only then applies its criticality.
- **Selector healing** — when every recorded selector fails,
  `worker/runner/heal.ts` collects visible interactive elements and scores them
  (`shared/heal-score.ts`) against the recorded labels, names, ids and roles.
  It only acts on a unique, confident winner (`0.5` for clicks, `0.6` for other
  actions), so it is better to skip a click than to press the wrong button.
  Healed selectors are logged per run.
- **Settling** — `worker/runner/settle.ts` waits for `domcontentloaded` and a
  capped/raced `networkidle` after navigation, and a short quiet period after
  actions, so late DOM swaps are observed without hanging on pages with
  long-lived connections.

## 12. Manual verification

Start the Chromium recorder (the in-browser proxy blocks localhost):

```bash
LIVE_RECORDER=false pnpm dev
```

Then create an automation and use these pages:

- **Field stability** — `http://localhost:3000/demo-fields.html`
  - Type an email, type a password, click **Show password**, edit the visible
    value, click **Clear password**, retype. Stop the recording and check that
    there is exactly **one** password field and one fill step (`secret: true`)
    with the last value semantics.
  - Run the saved automation and confirm it fills the password.
- **Dynamic rows** — `http://localhost:3000/demo-table.html`
  - Click **Load 10 rows**, then select the product table in the toolbar.
  - Save and run. The output must contain **10** rows even if you recorded when
    only 3 were visible.
- **Renamed keys** — click **Load renamed columns**, then select the table.
  - Save and run. The output keys must be `product_title`, `price_value`,
    `category_name` (current API keys), with no empty values and no nested
    `data.products` envelope.
- **API metadata** — the review panel shows the matched method + path, the
  field map, and a sanitized sample. The run logs show whether the response was
  observed or replayed.
- **Normalized output** — record the renamed-columns table above. The review
  panel shows "Canonical schema: ..." from the stored plan, and the run detail
  page shows an "Output schema" card (source, method, entity, count, columns).
  `GET /api/v1/runs/<id>` and the webhook include the same `meta` object; the
  `outputs` value has canonical keys only.
- **Obstruction remover** — `http://localhost:3000/demo-obstructions.html`
  - The page shows a cookie banner, a newsletter, a region prompt and a fake
    "Enter the characters you see" check at once.
  - Run `pnpm smoke` (no server needed): it asserts the first three are closed
    (`Reject all`, `No thanks`, `Continue`), the human check stays visible, and
    the live auto-dismiss script does the same.
  - Manually: record/run against the page and confirm "Accepted cookies" never
    appears in the logs (only `Rejected cookies`).
- **Resilience** — `http://localhost:3000/demo-instability.html`
  - Wait until the page says "DOM changed" (about 5 seconds), then record a
    click on **Add to cart now** and **Continue to payment**. A cookie banner
    appears; leave it alone.
  - Save and run. The fresh page still shows the old markup at click time, so
    every recorded selector misses; the log should show a healed selector for
    both buttons, the cookie banner should be dismissed automatically, and the
    run should end `SUCCESS`.
  - Also run with a recorded click on a button that no longer exists. It should
    log `preferred step failed and was skipped` instead of failing the run.
  - Mark a fill step as "Required step" and break its selector to confirm
    required steps still fail the run with an actionable error.
- **Live session** — with `LIVE_RECORDER=true pnpm dev`, open
  `http://localhost:3000/live` (use `localhost`, not the LAN URL) and start a
  session on `https://example.com`, then on `https://www.amazon.com`.
  - The site should render, the Thinklessly toolbar should appear top-right,
    and clicking a button should add a step. "End automation" opens the review.
  - If a frame stays blank after a proxy update, press **Reset proxy** in the
    failure dialog (or clear site data for `localhost`).
  - `pnpm sim` serves the HTTPS variant at `https://localhost:8443` with the
    same-origin `wss://` relay.

Run the automated checks:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm smoke   # real tsx + headless Chromium end-to-end run (healing, skip, meta)
pnpm adblock:fetch   # one-time, to enable offline ad blocking
```

`pnpm smoke` runs the full runner against an inline `data:` page (no server or
network needed): it heals a stale click, skips a `preferred` click whose target
is gone, fills a required input, extracts outputs with `meta`, and fails with a
non-zero exit code if any of those regress.

## Files involved

- `src/app/dashboard/automations/create/page.tsx`
- `src/components/automations/recorder-panel.tsx`, `recorder-review.tsx`
- `src/lib/automation-actions.ts`, `src/lib/output-actions.ts`
- `src/lib/live/{session,dom-extract,inject,scramjet}.ts`
- `src/components/live/live-recorder.tsx`
- `public/live/sw.js`, `public/demo-table.html`, `public/demo-fields.html`,
  `public/demo-instability.html`, `public/demo-obstructions.html`
- `scripts/fetch-adblock-lists.ts`, `scripts/smoke-obstructions.ts`
- `src/app/api/demo/products/route.ts`
- `worker/index.ts`, `worker/run-file.ts`
- `worker/browser/launch.ts`, `worker/network/collector.ts`
- `worker/recorder/{server,session,script,infer,sections,toolbar,api-capture,auto-dismiss}.ts`
- `worker/runner/{index,steps,selectors,heal,settle,obstruction,blocked,structured,api}.ts`
- `shared/{definition,fields,outputs,recorder-core,recorder-capture,recorder-merge,heal-score,obstructions}.ts`
- `shared/normalize/{types,dictionary,value,keys,output,index}.ts`
- `shared/{network,api-values,api-fields,api-match,api-extract,dom-snapshot}.ts`
