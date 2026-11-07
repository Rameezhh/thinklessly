import { isPlainObject } from "../api-values";
import {
  canonicalKey,
  isBooleanKey,
  isDateKey,
  isPriceKey,
  isStringKey,
  isUrlKey,
} from "./dictionary";
import {
  hasCurrencyMarker,
  isUrlText,
  parseBoolean,
  parseDate,
  parseNumber,
} from "./value";
import type { NormalizedType } from "./types";

/** Infers a canonical type from a key and a representative value. */
export function inferType(rawKey: string, value: unknown): NormalizedType {
  const key = canonicalKey(rawKey);
  if (Array.isArray(value)) return "array";
  if (isPlainObject(value)) return "object";
  if (isStringKey(key)) return "string";

  if (typeof value === "boolean") return "boolean";
  if (isBooleanKey(key) && typeof value === "string" && parseBoolean(value) !== null) return "boolean";

  if (key === "currency") return "string";

  if (isUrlKey(key) && typeof value === "string" && isUrlText(value)) return "url";
  if (typeof value === "string" && isUrlText(value) && /(url|image|avatar|link|href|photo|picture)/i.test(rawKey)) {
    return "url";
  }

  if (isPriceKey(key) && (typeof value === "number" || (typeof value === "string" && hasCurrencyMarker(value)))) {
    return "currency";
  }

  if (isDateKey(key) && parseDate(value) !== null) return "date";

  if (typeof value === "number") return "number";
  if (isPriceKey(key) && parseNumber(value) !== null) return "currency";
  if (typeof value === "string" && !isStringKey(key) && /^\d+(\.\d+)?$/.test(value.replace(/[,\s]/g, ""))) {
    return "number";
  }

  return "string";
}

/** Most common non-empty inferred type across sample values. */
export function majorityType(rawKey: string, values: unknown[]): NormalizedType {
  const counts = new Map<NormalizedType, number>();
  for (const value of values.slice(0, 20)) {
    if (value === null || value === undefined || value === "") continue;
    const type = inferType(rawKey, value);
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }

  let best: NormalizedType = "string";
  let bestCount = 0;
  for (const [type, count] of counts) {
    if (count > bestCount) {
      best = type;
      bestCount = count;
    }
  }
  return best;
}

export function stableType(type: NormalizedType): NormalizedType {
  return type === "currency" ? "number" : type;
}
