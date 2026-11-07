import { describe, expect, it } from "vitest";
import type { NetworkEntry } from "@shared/network";
import { matchesApi } from "./collector";

const entry: NetworkEntry = {
  id: "1",
  ts: Date.now(),
  method: "GET",
  url: "https://shop.example.com/api/items?count=3&q=shoe",
  status: 200,
  mime: "application/json",
  body: {},
};

const match = { method: "GET", pathname: "/api/items", origin: "https://shop.example.com", query: { q: "shoe" } };

describe("matchesApi", () => {
  it("matches method, origin, path and stable query", () => {
    expect(matchesApi(entry, match, true)).toBe(true);
  });

  it("ignores the query in loose mode so changed filters still match", () => {
    const changed = { ...entry, url: "https://shop.example.com/api/items?count=10&q=boot" };
    expect(matchesApi(changed, match, true)).toBe(false);
    expect(matchesApi(changed, match, false)).toBe(true);
  });

  it("rejects other origins, methods and failed responses", () => {
    expect(matchesApi({ ...entry, url: "https://evil.example.com/api/items?q=shoe" }, match, false)).toBe(false);
    expect(matchesApi({ ...entry, method: "POST" }, match, false)).toBe(false);
    expect(matchesApi({ ...entry, status: 500 }, match, false)).toBe(false);
  });
});