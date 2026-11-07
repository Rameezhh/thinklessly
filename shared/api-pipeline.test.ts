import { describe, expect, it } from "vitest";
import type { NetworkEntry } from "./network";
import { bestApiCandidate, type DomSnapshot } from "./api-match";
import { shapeApiBody } from "./api-extract";

const now = Date.now();

function entry(id: string, products: unknown[], ts = now): NetworkEntry {
  return {
    id,
    ts,
    method: "GET",
    url: "https://shop.example.com/api/demo/products?count=10",
    status: 200,
    mime: "application/json",
    body: { data: { products } },
  };
}

function snapshot(rows: string[][]): DomSnapshot {
  return {
    tag: "table",
    headers: ["Title", "Price", "Category"],
    rows: rows.slice(0, 5),
    values: rows.flat(),
    headings: ["Products"],
  };
}

function normalProducts(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    title: `Product ${index + 1}`,
    price: 10 + index * 3,
    category: index % 2 === 0 ? "Home" : "Tools",
  }));
}

function renamedProducts(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    product_title: `Product ${index + 1}`,
    price_value: 10 + index * 3,
    category_name: index % 2 === 0 ? "Home" : "Tools",
  }));
}

describe("recording -> API pipeline", () => {
  it("prefers the newest response when the row count changed", () => {
    const rows = normalProducts(10).map((item) => [item.title, String(item.price), item.category]);
    const best = bestApiCandidate(snapshot(rows), [
      entry("old", normalProducts(3), now - 20_000),
      entry("new", normalProducts(10)),
    ]);
    expect(best?.entryId).toBe("new");
    expect(best?.itemCount).toBe(10);
  });

  it("returns current renamed keys, flattened and without empty values", () => {
    const renamed = renamedProducts(5);
    const rows = renamed.map((item) => [item.product_title, String(item.price_value), item.category_name]);
    const best = bestApiCandidate(snapshot(rows), [entry("renamed", renamed)]);
    expect(best).not.toBeNull();
    if (!best) return;

    const output = shapeApiBody(entry("renamed", renamed).body, {
      shape: best.shape,
      path: best.path,
      fields: best.fields,
      keySource: "response",
      flatten: true,
      dropEmpty: true,
      limit: 500,
    });

    expect(output).toEqual([
      { product_title: "Product 1", price_value: 10, category_name: "Home" },
      { product_title: "Product 2", price_value: 13, category_name: "Tools" },
      { product_title: "Product 3", price_value: 16, category_name: "Home" },
      { product_title: "Product 4", price_value: 19, category_name: "Tools" },
      { product_title: "Product 5", price_value: 22, category_name: "Home" },
    ]);
  });
});