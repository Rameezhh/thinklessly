import { describe, expect, it } from "vitest";
import { parseDefinition } from "@shared/definition";
import { buildCaptureStep } from "./capture";

const css = [{ kind: "css" as const, value: "#orders" }];
const element = { selectors: css, name: "Orders", tag: "table" };

function existingSteps() {
  return parseDefinition({
    version: 1,
    startUrl: "https://example.com",
    fields: [],
    steps: [
      { id: "one", type: "extract", selectors: css, outputKey: "orders" },
    ],
  }).steps;
}

describe("buildCaptureStep", () => {
  it("builds a single-value step with a normalized key", () => {
    const result = buildCaptureStep(
      { kind: "single", element: { ...element, name: "Order ID" }, attribute: "text" },
      [],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.step.type).toBe("extract");
    if (result.step.type !== "extract") return;
    expect(result.step.outputKey).toBe("order_id");
    expect(result.step.selectors).toEqual(css);
  });

  it("makes a structured output key unique against existing steps", () => {
    const result = buildCaptureStep(
      {
        kind: "structured",
        container: element,
        root: {
          kind: "list",
          key: "orders",
          selector: "tbody tr",
          fields: [{ kind: "value", key: "id", selector: ":scope > td", attribute: "text" }],
        },
      },
      existingSteps(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.step.type).toBe("extractStructured");
    if (result.step.type !== "extractStructured") return;
    expect(result.step.root.key).toBe("orders_2");
  });

  it("rejects invalid or duplicate nested keys", () => {
    const result = buildCaptureStep(
      {
        kind: "structured",
        container: element,
        root: {
          kind: "object",
          key: "data",
          fields: [
            { kind: "value", key: "same", selector: ":scope > h1", attribute: "text" },
            { kind: "value", key: "same", selector: ":scope > h2", attribute: "text" },
          ],
        },
      },
      [],
    );
    expect(result.ok).toBe(false);
  });
});
