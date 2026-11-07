import { describe, expect, it } from "vitest";
import type { ApiField } from "./definition";
import { shapeApiBody, type ApiShapeInput } from "./api-extract";

function shape(overrides: Partial<ApiShapeInput> = {}): ApiShapeInput {
  return {
    shape: "list",
    path: [],
    fields: [],
    keySource: "response",
    flatten: true,
    dropEmpty: true,
    limit: 500,
    ...overrides,
  };
}

const titleField: ApiField = {
  key: "title",
  label: "Title",
  path: ["title"],
  aliases: ["title"],
  source: "api",
};

describe("shapeApiBody", () => {
  it("returns every current row, not the count seen while recording", () => {
    const body = { data: { products: Array.from({ length: 10 }, (_, index) => ({ title: `Item ${index}` })) } };
    const result = shapeApiBody(body, shape({ path: ["data", "products"], fields: [titleField] }));
    expect(Array.isArray(result)).toBe(true);
    expect((result as unknown[]).length).toBe(10);
  });

  it("uses the current API key names when keys are renamed", () => {
    const body = { items: [{ product_title: "Shoe", price: "$20" }] };
    const result = shapeApiBody(body, shape({ path: ["items"], fields: [titleField] }));
    expect(result).toEqual([{ product_title: "Shoe", price: "$20" }]);
  });

  it("flattens nested objects into underscore keys", () => {
    const body = [{ title: "Shoe", price: { value: 20, currency: "USD" } }];
    const result = shapeApiBody(body, shape({ fields: [titleField] }));
    expect(result).toEqual([{ title: "Shoe", price_value: 20, price_currency: "USD" }]);
  });

  it("drops empty keys and values", () => {
    const body = [{ title: "Shoe", subtitle: "", tags: [], stock: null }];
    const result = shapeApiBody(body, shape({ fields: [titleField] }));
    expect(result).toEqual([{ title: "Shoe" }]);
  });

  it("can pin human-readable labels as keys", () => {
    const body = [{ title: "Shoe" }];
    const result = shapeApiBody(
      body,
      shape({ fields: [titleField], keySource: "label" }),
    );
    expect(result).toEqual([{ title: "Shoe" }]);
  });

  it("falls back to a similarly shaped array when the recorded path changed", () => {
    const body = { data: { items: [{ title: "Shoe" }, { title: "Hat" }] } };
    const result = shapeApiBody(body, shape({ path: ["data", "products"], fields: [titleField] }));
    expect(result).toEqual([{ title: "Shoe" }, { title: "Hat" }]);
  });
});