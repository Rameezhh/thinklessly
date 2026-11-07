import { describe, expect, it } from "vitest";
import {
  buildPlan,
  canonicalKey,
  normalizeWithPlan,
  buildOutputMeta,
  metaForValue,
} from "./index";

describe("canonical keys", () => {
  it("maps common API aliases to stable concept keys", () => {
    expect(canonicalKey("ttl")).toBe("title");
    expect(canonicalKey("nm")).toBe("title");
    expect(canonicalKey("productName")).toBe("title");
    expect(canonicalKey("prc")).toBe("price");
    expect(canonicalKey("price_value")).toBe("price");
    expect(canonicalKey("imageUrl")).toBe("image_url");
    expect(canonicalKey("qty")).toBe("quantity");
    expect(canonicalKey("availability")).toBe("in_stock");
    expect(canonicalKey("createdAt")).toBe("created_at");
    expect(canonicalKey("asin")).toBe("asin");
  });
});

describe("buildPlan", () => {
  it("detects a product shape and orders the canonical columns", () => {
    const plan = buildPlan([
      { product_title: "Desk Lamp", price_value: "$24.99", availability: "In Stock", brand_name: "Acme" },
    ]);
    expect(plan.entity).toBe("product");
    const keys = plan.fields.map((field) => field.key);
    expect(keys[0]).toBe("title");
    expect(keys).toContain("price");
    expect(keys).toContain("in_stock");
    expect(keys).toContain("brand");
    expect(plan.fields.find((field) => field.key === "price")?.type).toBe("currency");
    expect(plan.fields.find((field) => field.key === "in_stock")?.type).toBe("boolean");
  });

  it("builds a scalar plan when a key is provided", () => {
    const plan = buildPlan("$12.50", { key: "price" });
    expect(plan.fields).toHaveLength(1);
    expect(plan.fields[0]?.key).toBe("price");
    expect(plan.fields[0]?.type).toBe("currency");
  });
});

describe("normalizeWithPlan", () => {
  it("keeps record-time keys even when the response renames them later", () => {
    const plan = buildPlan([
      { product_title: "Desk Lamp", price_value: 24.99, availability: "In Stock" },
    ]);

    const output = normalizeWithPlan(
      [
        { ttl: "Chair", prc: "$9.50", stock_status: "Out of stock", unknown_field: "kept" },
        { ttl: "Table", prc: "12", stock_status: "In stock" },
      ],
      plan,
    );

    expect(output).toEqual([
      { title: "Chair", price: 9.5, in_stock: false, unknown_field: "kept" },
      { title: "Table", price: 12, in_stock: true },
    ]);
  });

  it("coerces numbers, booleans, dates and urls and drops empty values", () => {
    const plan = buildPlan({
      id: "A-1",
      title: "Item",
      reviews: 12,
      verified: "yes",
      created_at: "2024-01-02T03:04:05Z",
      url: "https://example.com/item",
      note: "",
    });

    const output = normalizeWithPlan(
      {
        id: "A-1",
        title: "  Item  ",
        reviews: "1,204",
        verified: "yes",
        created_at: 1704164645000,
        url: "https://example.com/item",
        note: "   ",
      },
      plan,
    ) as Record<string, unknown>;

    expect(output.review_count).toBe(1204);
    expect(output.verified).toBe(true);
    expect(output.created_at).toBe("2024-01-02T03:04:05.000Z");
    expect(output.url).toBe("https://example.com/item");
    expect("note" in output).toBe(false);
  });

  it("does not emit duplicate or empty keys", () => {
    const plan = buildPlan({ productName: "One", title: "Two", empty: "" });
    const output = normalizeWithPlan({ productName: "One", title: "Two", empty: "" }, plan) as Record<string, unknown>;
    expect(output.title).toBe("One");
    expect(output.title_2).toBe("Two");
    expect("empty" in output).toBe(false);
  });
});

describe("output metadata", () => {
  it("describes an API list", () => {
    const plan = buildPlan([{ product_title: "A", price_value: 1 }]);
    const value = normalizeWithPlan([{ product_title: "A", price_value: 1 }], plan);
    const meta = buildOutputMeta(value, plan, "api", { endpoint: "https://shop/api", method: "GET" });
    expect(meta.source).toBe("api");
    expect(meta.entity).toBe("product");
    expect(meta.count).toBe(1);
    expect(meta.columns).toEqual(["title", "price"]);
    expect(meta.normalized).toBe(true);
  });

  it("describes a scalar", () => {
    const meta = metaForValue("42", "html");
    expect(meta).toMatchObject({ source: "html", columns: [], normalized: false });
  });
});
