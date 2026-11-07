export type PathSegment = string | number;

export type ScalarLeaf = {
  path: PathSegment[];
  key: string;
  value: string;
};

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Loose comparison form: removes currency symbols, punctuation and spaces. */
export function looseValue(value: string): string {
  return normalizeText(value).replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Turns camelCase / PascalCase / kebab / human labels into stable snake_case keys. */
export function normalizeKey(value: string, fallback = "field"): string {
  const spaced = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  const slug = spaced
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  if (!slug) return fallback;
  return /^[a-z]/.test(slug) ? slug : `field_${slug}`;
}

export function humanizeKey(value: string, fallback = "field"): string {
  return normalizeKey(value, fallback);
}

export function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  const [small, large] = left.size <= right.size ? [left, right] : [right, left];
  for (const value of small) {
    if (large.has(value)) shared += 1;
  }
  return shared / (left.size + right.size - shared);
}

export function getPath(root: unknown, path: PathSegment[]): unknown {
  let current: unknown = root;
  for (const segment of path) {
    if (current === null || current === undefined) return undefined;
    if (typeof segment === "number") {
      if (!Array.isArray(current)) return undefined;
      current = current[segment];
    } else {
      if (typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[segment];
    }
  }
  return current;
}

export function scalarString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return null;
}

/** Walks scalar leaves of a JSON document. Paths are useful for extraction. */
export function scalarLeaves(root: unknown, limits: { maxLeaves?: number; maxDepth?: number } = {}): ScalarLeaf[] {
  const maxLeaves = limits.maxLeaves ?? 20_000;
  const maxDepth = limits.maxDepth ?? 8;
  const leaves: ScalarLeaf[] = [];

  function visit(value: unknown, path: PathSegment[], depth: number): void {
    if (leaves.length >= maxLeaves || depth > maxDepth) return;
    const scalar = scalarString(value);
    if (scalar !== null) {
      const key = [...path].reverse().find((part): part is string => typeof part === "string") ?? "value";
      leaves.push({ path, key, value: scalar });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...path, index], depth + 1));
      return;
    }
    if (isPlainObject(value)) {
      for (const [key, item] of Object.entries(value)) {
        visit(item, [...path, key], depth + 1);
      }
    }
  }

  visit(root, [], 0);
  return leaves;
}

export type JsonArrayCandidate = {
  path: PathSegment[];
  value: unknown[];
};

/** Finds every array in a JSON document, with its path. */
export function collectArrays(root: unknown, limits: { maxDepth?: number; maxArrays?: number } = {}): JsonArrayCandidate[] {
  const maxDepth = limits.maxDepth ?? 7;
  const maxArrays = limits.maxArrays ?? 80;
  const arrays: JsonArrayCandidate[] = [];

  function visit(value: unknown, path: PathSegment[], depth: number): void {
    if (arrays.length >= maxArrays || depth > maxDepth) return;
    if (Array.isArray(value)) {
      if (value.length > 0) arrays.push({ path, value });
      value.slice(0, 20).forEach((item, index) => visit(item, [...path, index], depth + 1));
      return;
    }
    if (isPlainObject(value)) {
      for (const [key, item] of Object.entries(value)) {
        visit(item, [...path, key], depth + 1);
      }
    }
  }

  visit(root, [], 0);
  return arrays;
}

/** Flattens a nested object into `parent_child` keys; arrays are kept intact. */
export function flattenRecord(
  value: Record<string, unknown>,
  limits: { prefix?: string; maxDepth?: number } = {},
): Record<string, unknown> {
  const maxDepth = limits.maxDepth ?? 3;
  const output: Record<string, unknown> = {};

  function add(record: Record<string, unknown>, prefix: string, depth: number): void {
    for (const [key, item] of Object.entries(record)) {
      const name = prefix ? `${prefix}_${key}` : key;
      if (isPlainObject(item) && depth < maxDepth) {
        add(item, name, depth + 1);
      } else {
        output[normalizeKey(name, "field")] = item;
      }
    }
  }

  add(value, limits.prefix ?? "", 0);
  return output;
}

export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (isPlainObject(value)) return Object.keys(value).length === 0;
  if (typeof value === "number") return Number.isNaN(value);
  return false;
}