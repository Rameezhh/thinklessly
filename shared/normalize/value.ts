import { normalizeText } from "../api-values";
import type { NormalizedType } from "./types";

const TRUE_VALUES = new Set(["true", "yes", "y", "1", "in stock", "instock", "available", "enabled", "active", "on", "sold"]);
const FALSE_VALUES = new Set(["false", "no", "n", "0", "out of stock", "outofstock", "unavailable", "disabled", "inactive", "off", "sold out"]);
const CURRENCY_SYMBOL = /^[\s]*[$€£¥₹₩₽₺₪₫₴₦₱]/;
const CURRENCY_CODE = /(USD|EUR|GBP|JPY|INR|CAD|AUD|CHF|CNY|SEK|NOK|DKK|BRL|MXN|NZD|SGD|HKD|ZAR)\b/i;

export function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", "#34": '"',
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#?\w+);/g, (match, name: string) => ENTITIES[name] ?? ENTITIES[name.toLowerCase()] ?? match);
}

export function cleanText(value: string): string {
  return decodeEntities(stripHtml(value)).replace(/\s+/g, " ").trim();
}

export function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const compact = value.trim().replace(/[,\s]/g, "");
  if (!compact) return null;
  const numeric = compact
    .replace(/^[^\d+\-.]+/, "")
    .replace(/[^\d.%]+$/, "")
    .replace(/%$/, "");
  if (!/^[+-]?\d+(\.\d+)?$/.test(numeric)) return null;
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const text = normalizeText(value);
  if (TRUE_VALUES.has(text)) return true;
  if (FALSE_VALUES.has(text)) return false;
  return null;
}

export function parseDate(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 100_000_000_000 ? value : value > 100_000_000 ? value * 1000 : null;
    if (ms === null) return null;
    const date = new Date(ms);
    return validDate(date) ? date.toISOString() : null;
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (/^\d{10}$/.test(text)) return parseDate(Number(text));
  if (/^\d{13}$/.test(text)) return parseDate(Number(text));
  if (!/^\d{4}-\d{2}-\d{2}/.test(text) && !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(text)) return null;
  const date = new Date(text);
  return validDate(date) ? date.toISOString() : null;
}

function validDate(date: Date): boolean {
  const year = date.getFullYear();
  return !Number.isNaN(date.getTime()) && year >= 1970 && year <= 3000;
}

export function isUrlText(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim()) || /^\/\/\S+$/.test(value.trim());
}

export function hasCurrencyMarker(value: string): boolean {
  return CURRENCY_SYMBOL.test(value) || CURRENCY_CODE.test(value);
}

/** Applies a canonical type to a raw value. Failed coercions keep the original value. */
export function coerce(value: unknown, type: NormalizedType): unknown {
  switch (type) {
    case "number":
    case "currency": {
      const parsed = parseNumber(value);
      return parsed ?? value;
    }
    case "boolean": {
      const parsed = parseBoolean(value);
      return parsed ?? value;
    }
    case "date": {
      const parsed = parseDate(value);
      return parsed ?? value;
    }
    case "url": {
      return typeof value === "string" ? value.trim() : value;
    }
    case "string": {
      if (typeof value === "string") return cleanText(value);
      if (typeof value === "number" || typeof value === "boolean") return String(value);
      return value;
    }
    case "array":
    case "object":
      return value;
  }
}

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  if (typeof value === "number") return Number.isNaN(value);
  return false;
}
