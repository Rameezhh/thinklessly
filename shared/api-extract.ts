import type { ApiField, PathSegment } from "./definition";
import {
  collectArrays,
  flattenRecord,
  getPath,
  humanizeKey,
  isEmptyValue,
  isPlainObject,
  normalizeKey,
  scalarString,
} from "./api-values";

export type ApiShapeInput = {
  shape: "list" | "object" | "value";
  path: PathSegment[];
  fields: ApiField[];
  keySource: "response" | "label";
  flatten: boolean;
  dropEmpty: boolean;
  limit: number;
};

export type FieldResolution = {
  value: unknown;
  keyPath: PathSegment[];
};

function findLeafByAlias(item: unknown, aliases: string[]): { path: PathSegment[]; value: unknown } | null {
  const wanted = new Set(aliases.map((alias) => normalizeKey(alias)).filter(Boolean));
  if (wanted.size === 0) return null;

  function visit(value: unknown, path: PathSegment[], depth: number): { path: PathSegment[]; value: unknown } | null {
    if (depth > 4 || value === null || value === undefined) return null;
    if (isPlainObject(value)) {
      for (const [key, child] of Object.entries(value)) {
        if (wanted.has(normalizeKey(key))) return { path: [...path, key], value: child };
        const nested = visit(child, [...path, key], depth + 1);
        if (nested) return nested;
      }
    }
    return null;
  }

  return visit(item, [], 0);
}

function resolveField(item: unknown, field: ApiField): FieldResolution | null {
  if (field.path.length > 0) {
    const value = getPath(item, field.path);
    if (value !== undefined) return { value, keyPath: field.path };
  }
  const aliases = [field.key, field.label, ...field.aliases].filter((alias): alias is string => Boolean(alias));
  const byAlias = findLeafByAlias(item, aliases);
  if (byAlias) return { value: byAlias.value, keyPath: byAlias.path };
  if (isPlainObject(item)) {
    const wanted = normalizeKey(field.label || field.key);
    for (const [key, value] of Object.entries(item)) {
      if (normalizeKey(key) === wanted) return { value, keyPath: [key] };
    }
  }
  return null;
}

function keyFrom(field: ApiField, keyPath: PathSegment[], keySource: "response" | "label"): string {
  if (keySource === "label" && field.label) return humanizeKey(field.label);
  const parts = keyPath.filter((part): part is string => typeof part === "string");
  if (parts.length > 0) return humanizeKey(parts.join("_"), field.key);
  return humanizeKey(field.label || field.key);
}

function addValue(
  output: Record<string, unknown>,
  key: string,
  value: unknown,
  shape: ApiShapeInput,
): void {
  if (isPlainObject(value) && shape.flatten) {
    const base = humanizeKey(key, "field");
    const flattened = flattenRecord(value, { prefix: base, maxDepth: 3 });
    for (const [childKey, childValue] of Object.entries(flattened)) {
      if (shape.dropEmpty && isEmptyValue(childValue)) continue;
      output[childKey] = childValue;
    }
    return;
  }
  if (shape.dropEmpty && isEmptyValue(value)) return;
  output[key] = value;
}

function uniqueKey(output: Record<string, unknown>, key: string): string {
  if (!(key in output)) return key;
  let suffix = 2;
  while (`${key}_${suffix}` in output) suffix += 1;
  return `${key}_${suffix}`;
}

export function shapeRow(item: unknown, shape: ApiShapeInput): unknown {
  if (!isPlainObject(item)) {
    if (shape.shape === "value") return scalarString(item) ?? item ?? null;
    return shape.dropEmpty && isEmptyValue(item) ? null : item;
  }

  const output: Record<string, unknown> = {};
  const consumed = new Set<string>();

  for (const field of shape.fields) {
    if (field.source === "dom") continue;
    const resolved = resolveField(item, field);
    if (!resolved) continue;
    if (resolved.keyPath.length > 0) consumed.add(String(resolved.keyPath[0]));
    const key = uniqueKey(output, keyFrom(field, resolved.keyPath, shape.keySource));
    addValue(output, key, resolved.value, shape);
  }

  for (const [key, value] of Object.entries(item)) {
    if (consumed.has(key)) continue;
    if (shape.keySource === "label" && shape.fields.length > 0) continue;
    const outputKey = uniqueKey(output, humanizeKey(key));
    addValue(output, outputKey, value, shape);
  }

  return output;
}

export function findBestArray(body: unknown, fields: ApiField[]): { path: PathSegment[]; value: unknown[] } | null {
  const wanted = new Set(
    fields.flatMap((field) => [field.key, field.label, ...field.aliases])
      .filter((value): value is string => Boolean(value))
      .map((value) => normalizeKey(value)),
  );

  let best: { path: PathSegment[]; value: unknown[]; score: number } | null = null;
  for (const candidate of collectArrays(body)) {
    let score = 0;
    for (const item of candidate.value.slice(0, 20)) {
      if (!isPlainObject(item)) continue;
      for (const key of Object.keys(item)) {
        if (wanted.has(normalizeKey(key))) score += 2;
      }
    }
    score += Math.min(candidate.value.length, 50) * 0.01;
    if (!best || score > best.score) best = { ...candidate, score };
  }
  return best ? { path: best.path, value: best.value } : null;
}

export function shapeApiBody(body: unknown, shape: ApiShapeInput): unknown {
  let source = getPath(body, shape.path);

  if (shape.shape === "list" && !Array.isArray(source)) {
    const found = findBestArray(body, shape.fields);
    source = found?.value;
  }

  if (shape.shape === "value") {
    const scalar = scalarString(source);
    return scalar ?? source ?? null;
  }

  if (shape.shape === "object") {
    const target = isPlainObject(source) ? source : body;
    return shapeRow(target, shape);
  }

  if (!Array.isArray(source)) return source ?? null;
  const items = source.slice(0, Math.max(1, shape.limit));
  return items.map((item) => shapeRow(item, shape));
}