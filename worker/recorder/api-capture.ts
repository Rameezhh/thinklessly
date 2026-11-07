import type { Page } from "playwright";
import type { ExtractField } from "@shared/definition";
import { bestApiCandidate } from "@shared/api-match";
import { shapeApiBody } from "@shared/api-extract";
import { buildApiCaptureStep, capturePayloadSchema, type ApiCaptureStep } from "@shared/recorder-capture";
import { collectDomSnapshot } from "@shared/dom-snapshot";
import { normalizeOutputKey } from "@shared/outputs";
import type { RecorderCore, PushResult } from "@shared/recorder-core";
import type { NetworkCollector } from "../network/collector";
import { resolveLocator } from "../runner/selectors";

export type ApiCaptureInfo = {
  score: number;
  method: string;
  url: string;
  itemCount?: number;
  shape: string;
};

export type ApiCaptureResult = {
  pushed: PushResult;
  preview: unknown;
  api: ApiCaptureInfo;
};

export async function captureApiStep(options: {
  core: RecorderCore;
  network: NetworkCollector;
  payload: unknown;
  page: Page;
  selectionId?: string;
}): Promise<ApiCaptureResult | null> {
  const { core, network, payload, page, selectionId } = options;
  const parsed = capturePayloadSchema.safeParse(payload);
  if (!parsed.success) return null;
  const data = parsed.data;
  const containerSelectors = data.kind === "single" ? data.element.selectors : data.container.selectors;
  const containerName = data.kind === "single" ? data.element.name : data.container.name;
  const containerTag = data.kind === "single" ? data.element.tag : data.container.tag;

  try {
    const { locator } = await resolveLocator(page, containerSelectors, 2500, () => undefined, "capture");
    const snapshot = await locator.evaluate(collectDomSnapshot);
    const candidate = bestApiCandidate(snapshot, network.entries, 0.5);
    if (!candidate) return null;
    const entry = network.entries.find((item) => item.id === candidate.entryId);
    if (!entry || entry.body === undefined) return null;

    const fallback: ExtractField =
      data.kind === "single"
        ? {
            kind: "value",
            key: normalizeOutputKey(data.element.name || "value"),
            selector: ":scope",
            attribute: data.attribute || "text",
          }
        : data.root;

    const step: ApiCaptureStep = buildApiCaptureStep(
      {
        candidate,
        entry,
        container: { selectors: containerSelectors, name: containerName, tag: containerTag },
        fallback,
        fallbackSelectors: containerSelectors,
      },
      core.steps,
    );
    const pushed = core.pushCapture(step, selectionId);
    if (!pushed) return null;

    return {
      pushed,
      preview: shapeApiBody(entry.body, step),
      api: {
        score: Number(candidate.score.toFixed(3)),
        method: candidate.method,
        url: candidate.url,
        itemCount: candidate.itemCount,
        shape: candidate.shape,
      },
    };
  } catch {
    return null;
  }
}