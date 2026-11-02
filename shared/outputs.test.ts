import { describe, expect, it } from "vitest";
import { parseDefinition, type ExtractField, type Step } from "./definition";
import {
  normalizeOutputKey,
  outputIssuesForSteps,
  outputKeysIn,
  uniqueOutputKey,
  validateStructuredField,
} from "./outputs";

function definition(steps: unknown[]) {
  return parseDefinition({
    version: 1,
    startUrl: "https://example.com",
    fields: [],
    steps,
  });
}

describe("output key helpers", () => {
  it("normalizes labels into snake_case", () => {
    expect(normalizeOutputKey("Product Name")).toBe("product_name");
    expect(normalizeOutputKey("  $Price (USD)! ")).toBe("price_usd");
    expect(normalizeOutputKey("2nd item")).toBe("field_2nd_item");
    expect(normalizeOutputKey("")).toBe("data");
  });

  it("adds suffixes until the key is unique", () => {
    expect(uniqueOutputKey("price", ["price"])).toBe("price_2");
    expect(uniqueOutputKey("price", ["price", "price_2"])).toBe("price_3");
    expect(uniqueOutputKey("name", ["other"])).toBe("name");
  });

  it("collects output keys from every extraction step", () => {
    const value: ExtractField = { kind: "value", key: "page", selector: ":scope", attribute: "text" };
    const keys = outputKeysIn(
      definition([
        { id: "one", type: "extract", selectors: [{ kind: "css", value: "h1" }], outputKey: "title" },
        {
          id: "two",
          type: "extractStructured",
          selectors: [{ kind: "css", value: "main" }],
          root: value,
        },
      ]),
    );
    expect(keys).toEqual(["title", "page"]);
  });

  it("reports empty selectors and attributes", () => {
    const root: ExtractField = { kind: "value", key: "page", selector: "", attribute: "" };
    const messages = validateStructuredField(root).map((issue) => issue.message);
    expect(messages).toContain("Selector is required");
    expect(messages).toContain("Attribute is required");
  });

  it("reports duplicate output keys across extraction steps", () => {
    const steps = [
      { id: "one", type: "extract", selectors: [{ kind: "css", value: "h1" }], outputKey: "data" },
      {
        id: "two",
        type: "extractStructured",
        selectors: [{ kind: "css", value: "main" }],
        root: { kind: "value", key: "data", selector: ":scope", attribute: "text" },
      },
    ] as Step[];
    expect(outputIssuesForSteps(steps).some((issue) => issue.message.includes("Duplicate"))).toBe(true);
  });

  it("reports duplicate nested keys", () => {
    const root: ExtractField = {
      kind: "object",
      key: "page",
      fields: [
        { kind: "value", key: "title", selector: ":scope > h1", attribute: "text" },
        { kind: "value", key: "title", selector: ":scope > h2", attribute: "text" },
      ],
    };
    const issues = validateStructuredField(root);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain("Duplicate");
  });
});
