import { flattenRecord, isPlainObject, normalizeKey } from "../api-values";
import {
  aliasesFor,
  canonicalKey,
  detectEntity,
  templateFor,
} from "./dictionary";
import { inferType, majorityType } from "./keys";
import type { NormalizeField, NormalizePlan, OutputMeta } from "./types";
import { cleanText, coerce, isEmpty } from "./value";

const MAX_SAMPLE_ROWS = 20;
const MAX_ALIASES = 60;

export type BuildPlanOptions = {
  key?: string;
  entity?: string;
  flatten?: boolean;
  dropEmpty?: boolean;
  coerce?: boolean;
};

function sampleRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(isPlainObject).slice(0, MAX_SAMPLE_ROWS);
  if (isPlainObject(value)) return [value];
  return [];
}

function uniqueAliases(values: string[]): string[] {
  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const value of values) {
    const normalized = normalizeKey(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    aliases.push(value);
    if (aliases.length >= MAX_ALIASES) break;
  }
  return aliases;
}

/**
 * Derives a stable output shape from a sample response. The resulting plan is
 * persisted on the step so later runs reuse exactly the same keys and types.
 */
export function buildPlan(value: unknown, options: BuildPlanOptions = {}): NormalizePlan {
  const flatten = options.flatten ?? true;
  const rows = sampleRows(value);
  const orderedKeys: string[] = [];
  const valuesByKey = new Map<string, unknown[]>();
  const aliasesByKey = new Map<string, Set<string>>();

  for (const row of rows) {
    const flat = flatten ? flattenRecord(row, { maxDepth: 3 }) : row;
    for (const [rawKey, rawValue] of Object.entries(flat)) {
      const key = canonicalKey(rawKey);
      if (!valuesByKey.has(key)) {
        valuesByKey.set(key, []);
        aliasesByKey.set(key, new Set<string>());
        orderedKeys.push(key);
      }
      valuesByKey.get(key)?.push(rawValue);
      aliasesByKey.get(key)?.add(rawKey);
    }
  }

  if (orderedKeys.length === 0 && options.key) {
    const key = canonicalKey(options.key);
    orderedKeys.push(key);
    valuesByKey.set(key, [value]);
    aliasesByKey.set(key, new Set([options.key]));
  }

  const entity = options.entity ?? detectEntity(orderedKeys);
  const template = templateFor(entity);
  const preferred = template
    ? [...new Set(["id", ...template.required, ...template.fields])]
    : [];
  const presentPreferred = preferred.filter((key) => valuesByKey.has(key));
  const ordered = [...presentPreferred, ...orderedKeys.filter((key) => !presentPreferred.includes(key))];

  const fields: NormalizeField[] = ordered.map((key) => ({
    key,
    type: majorityType(key, valuesByKey.get(key) ?? []),
    aliases: uniqueAliases([key, ...(aliasesByKey.get(key) ?? []), ...aliasesFor(key)]),
  }));

  return {
    version: 1,
    entity,
    fields,
    flatten,
    dropEmpty: options.dropEmpty ?? true,
    coerce: options.coerce ?? true,
  };
}

type FieldLookup = Map<string, NormalizeField>;

function buildLookup(plan: NormalizePlan): FieldLookup {
  const lookup: FieldLookup = new Map();
  for (const field of plan.fields) {
    lookup.set(normalizeKey(field.key), field);
    for (const alias of field.aliases) lookup.set(normalizeKey(alias), field);
  }
  return lookup;
}

function addValue(
  output: Record<string, unknown>,
  key: string,
  value: unknown,
  plan: NormalizePlan,
  type: NormalizeField["type"],
): void {
  const next = plan.coerce ? coerce(value, type) : value;
  if (plan.dropEmpty && isEmpty(next)) return;

  if (!(key in output)) {
    output[key] = next;
    return;
  }
  if (JSON.stringify(output[key]) === JSON.stringify(next)) return;

  let suffix = 2;
  while (`${key}_${suffix}` in output) suffix += 1;
  output[`${key}_${suffix}`] = next;
}

function normalizeRecord(
  record: Record<string, unknown>,
  plan: NormalizePlan,
  lookup: FieldLookup,
): Record<string, unknown> {
  const flat = plan.flatten ? flattenRecord(record, { maxDepth: 3 }) : record;
  const matched = new Map<string, unknown[]>();
  const extras: Array<[string, unknown]> = [];

  for (const [rawKey, rawValue] of Object.entries(flat)) {
    const field = lookup.get(normalizeKey(rawKey));
    if (field) {
      const values = matched.get(field.key) ?? [];
      values.push(rawValue);
      matched.set(field.key, values);
    } else {
      extras.push([rawKey, rawValue]);
    }
  }

  const output: Record<string, unknown> = {};
  for (const field of plan.fields) {
    for (const value of matched.get(field.key) ?? []) {
      addValue(output, field.key, value, plan, field.type);
    }
  }
  for (const [rawKey, rawValue] of extras) {
    const key = canonicalKey(rawKey);
    addValue(output, key, rawValue, plan, inferType(key, rawValue));
  }
  return output;
}

function normalizeScalar(value: unknown, plan: NormalizePlan): unknown {
  const field = plan.fields[0];
  if (field) return plan.coerce ? coerce(value, field.type) : value;
  if (typeof value === "string") return cleanText(value);
  return value;
}

/** Applies a stored plan to a fresh response, keeping record-time and run-time output identical. */
export function normalizeWithPlan(value: unknown, plan: NormalizePlan): unknown {
  const lookup = buildLookup(plan);
  if (Array.isArray(value)) {
    return value.map((item) => (isPlainObject(item) ? normalizeRecord(item, plan, lookup) : normalizeScalar(item, plan)));
  }
  if (isPlainObject(value)) return normalizeRecord(value, plan, lookup);
  return normalizeScalar(value, plan);
}

export function metaForValue(
  value: unknown,
  source: "api" | "html",
  extra: { endpoint?: string; method?: string; entity?: string; normalized?: boolean } = {},
): OutputMeta {
  const rows = Array.isArray(value) ? value : isPlainObject(value) ? [value] : [];
  const columns = new Set<string>();
  for (const row of rows.slice(0, MAX_SAMPLE_ROWS)) {
    for (const key of Object.keys(row)) columns.add(key);
  }
  return {
    source,
    endpoint: extra.endpoint,
    method: extra.method,
    entity: extra.entity,
    count: Array.isArray(value) ? value.length : undefined,
    columns: [...columns].slice(0, 300),
    normalized: extra.normalized ?? false,
  };
}

export function buildOutputMeta(
  value: unknown,
  plan: NormalizePlan,
  source: "api" | "html",
  extra: { endpoint?: string; method?: string } = {},
): OutputMeta {
  return metaForValue(value, source, {
    endpoint: extra.endpoint,
    method: extra.method,
    entity: plan.entity,
    normalized: plan.fields.length > 0,
  });
}
