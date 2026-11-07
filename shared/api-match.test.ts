import { describe, expect, it } from "vitest";
import type { NetworkEntry } from "./network";
import { bestApiCandidate, rankApiCandidates, type DomSnapshot } from "./api-match";

const now = Date.now();

const entry: NetworkEntry = {
  id: "entry-1",
  ts: now,
  method: "GET",
  url: "https://shop.example.com/api/search?q=shoe",
  status: 200,
  mime: "application/json",
  body: {
    data: {
      products: [
        { title: "Red Shoe", price: "$20", rating: 4.5 },
        { title: "Blue Hat", price: "$10", rating: 4.1 },
      ],
    },
  },
};

function snapshot(overrides: Partial<DomSnapshot> = {}): DomSnapshot {
  return {
    tag: "table",
    headers: ["Title", "Price"],
    rows: [["Red Shoe", "$20"]],
    values: ["Red Shoe", "$20", "Blue Hat", "$10"],
    headings: ["Products"],
    ...overrides,
  };
}

describe("api matching", () => {
  it("finds the array that produced the selected table", () => {
    const candidate = bestApiCandidate(snapshot(), [entry], 0.5);
    expect(candidate).not.toBeNull();
    expect(candidate?.path).toEqual(["data", "products"]);
    expect(candidate?.method).toBe("GET");
    expect(candidate?.fields.map((field) => field.key)).toEqual(["title", "price"]);
    expect(candidate?.joinKey).toBe("title");
  });

  it("marks columns missing from the API so they can be read from HTML", () => {
    const candidate = bestApiCandidate(
      snapshot({ headers: ["Title", "Stock"], rows: [["Red Shoe", "In stock"]] }),
      [entry],
      0.5,
    );
    expect(candidate).not.toBeNull();
    const stock = candidate?.fields.find((field) => field.key === "stock");
    expect(stock?.source).toBe("dom");
    expect(stock?.domSelector).toContain("nth-child(2)");
  });

  it("matches a single selected value to an exact scalar leaf", () => {
    const candidate = bestApiCandidate(
      { tag: "span", values: ["Red Shoe"], headers: [], rows: [] },
      [entry],
      0.5,
    );
    expect(candidate?.shape).toBe("value");
    expect(candidate?.path).toEqual(["data", "products", 0, "title"]);
  });

  it("ignores failed responses", () => {
    const failed: NetworkEntry = { ...entry, status: 500 };
    expect(rankApiCandidates(snapshot(), [failed])).toHaveLength(0);
  });
});