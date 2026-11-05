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
  - registers Playwright bindings: `__webtomateRecord` (always),
    `__webtomateCapture` and `__webtomateRemove` (when `captureData`),
  - injects init scripts: `buildRecorderScript()` always, plus
    `buildInferScript()`, `buildSectionsScript()`, `buildToolbarScript()` when
    `captureData`,
  - opens `startUrl`, pushes a `goto` step, and sets status to `recording`.

## 3. Toolbar overlay (`worker/recorder/toolbar.ts`)

Injected into the target page (only when `window.top === window`) as a
closed-shadow-DOM host carrying `[data-webtomate-ui]`. It renders:

- a floating "Webtomate data" panel top-right, collapsible to a round FAB,
- a hover highlight box with a tag describing the hovered element,
- coloured, labelled candidate boxes over detected sections,
- a toast for feedback.

"Select data" turns on **pick mode**:

- `mousemove` highlights the element under the cursor,
- `renderCandidates()` calls `__webtomateDetectSections()` and draws clickable
  boxes over detected tables / forms / lists / objects,
- clicking a candidate or any element calls `classify()`:
  - `__webtomateInferAuto(el)` returns a plan → payload
    `{ kind: "structured", container, root }`,
  - otherwise → payload `{ kind: "single", element, attribute: "text" }`.
- The payload is sent via `__webtomateCapture({ payload, selectionId })`.
- The selections list shows `single`/`data` badges, supports remove, "Add
  another selection", "Done" (confirm) and "Cancel" (sends `__webtomateRemove`).

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
- Every event is sent via `__webtomateRecord(payload)`.

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

## Files involved

- `src/app/dashboard/automations/create/page.tsx`
- `src/components/automations/recorder-panel.tsx`, `recorder-review.tsx`
- `src/lib/automation-actions.ts`
- `worker/index.ts`
- `worker/recorder/{server,session,script,infer,sections,toolbar,capture,merge}.ts`
- `worker/runner/{selectors,structured}.ts`
- `shared/{definition,fields,outputs}.ts`
