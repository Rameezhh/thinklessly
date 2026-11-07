import type { ApiField, PathSegment } from "./definition";
import type { NetworkEntry } from "./network";
import { buildFields, itemKeySet, itemValues, joinKeyFor } from "./api-fields";
import {
  collectArrays,
  humanizeKey,
  isPlainObject,
  jaccard,
  looseValue,
  normalizeKey,
  normalizeText,
  scalarLeaves,
} from "./api-values";

export type DomSnapshot = {
  tag: string;
  name?: string;
  headings?: string[];
  headers?: string[];
  rows?: string[][];
  values?: string[];
  attributes?: Record<string, string>;
};

export type ApiCandidate = {
  entryId: string;
  score: number;
  path: PathSegment[];
  shape: "list" | "object" | "value";
  fields: ApiField[];
  joinKey?: string;
  method: string;
  url: string;
  itemCount?: number;
  preview: unknown;
  reason: string;
};

const RECENCY_WINDOW_MS = 120_000;
const VOLATILE_QUERY = /^(_|t|ts|time|timestamp|page.*|cursor.*|offset|limit|start|end|from|to|token|sig|signature|nonce|auth|session)$/i;

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function buildApiMatch(entry: NetworkEntry): {
  method: string;
  pathname: string;
  origin?: string;
  query: Record<string, string>;
} {
  const url = safeUrl(entry.url);
  const query: Record<string, string> = {};
  if (url) {
    for (const [key, value] of url.searchParams) {
      if (VOLATILE_QUERY.test(key)) continue;
      if (value.length === 0 || value.length > 200) continue;
      query[key] = value;
    }
  }
  return {
    method: (entry.method || "GET").toUpperCase(),
    pathname: (url?.pathname ?? entry.url).slice(0, 2000),
    origin: url?.origin,
    query,
  };
}

function domValueSet(snapshot: DomSnapshot): string[] {
  const values = new Set<string>();
  for (const value of snapshot.values ?? []) {
    const normalized = normalizeText(value);
    if (normalized.length >= 2) values.add(normalized);
    if (values.size >= 400) break;
  }
  return [...values];
}

function recencyScore(entry: NetworkEntry, now: number): number {
  const age = Math.max(0, now - entry.ts);
  return Math.max(0, 1 - age / RECENCY_WINDOW_MS);
}

function scoreList(items: unknown[], snapshot: DomSnapshot, entry: NetworkEntry, now: number): {
  score: number;
  fields: ApiField[];
  joinKey?: string;
} {
  const objects = items.filter(isPlainObject);
  if (objects.length === 0) return { score: 0, fields: [] };

  const values = itemValues(objects);
  const keys = itemKeySet(objects);
  const domValues = domValueSet(snapshot);
  const sample = domValues.slice(0, 300);
  const hits = sample.filter(
    (value) => values.has(value) || values.has(looseValue(value)),
  ).length;
  const valueOverlap = sample.length > 0 ? hits / sample.length : 0;

  const headers = new Set(
    [...(snapshot.headers ?? []), ...(snapshot.headings ?? [])].map((value) => normalizeKey(value)).filter(Boolean),
  );
  const keyOverlap = jaccard(headers, keys);

  const rows = (snapshot.rows ?? []).slice(0, 5);
  let rowFit = 0;
  for (const row of rows) {
    let bestRow = 0;
    for (const item of objects.slice(0, 100)) {
      const itemSet = itemValues([item]);
      const cells = row.map((cell) => normalizeText(cell)).filter((cell) => cell.length >= 2);
      if (cells.length === 0) continue;
      const matched = cells.filter(
        (cell) => itemSet.has(cell) || itemSet.has(looseValue(cell)),
      ).length;
      bestRow = Math.max(bestRow, matched / cells.length);
    }
    rowFit += bestRow;
  }
  rowFit = rows.length > 0 ? rowFit / rows.length : 0;

  const score =
    0.5 * valueOverlap + 0.25 * keyOverlap + 0.2 * rowFit + 0.05 * recencyScore(entry, now);
  const fields = buildFields(objects, snapshot);
  return { score, fields, joinKey: joinKeyFor(objects, fields) };
}

function previewOf(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, 20);
  return value;
}

export function rankApiCandidates(
  snapshot: DomSnapshot,
  entries: NetworkEntry[],
  options: { limit?: number; now?: number } = {},
): ApiCandidate[] {
  const limit = options.limit ?? 5;
  const now = options.now ?? Date.now();
  const candidates: ApiCandidate[] = [];
  const wantsSingle = (snapshot.rows?.length ?? 0) === 0 && (snapshot.headers?.length ?? 0) === 0;

  for (const entry of entries) {
    if (entry.status >= 400) continue;
    if (entry.body === undefined) continue;
    const match = buildApiMatch(entry);

    if (wantsSingle) {
      const wanted = (snapshot.values ?? []).map((value) => normalizeText(value)).find((value) => value.length >= 2);
      if (!wanted) continue;
      const wantedLoose = looseValue(wanted);
      const leaves = scalarLeaves(entry.body, { maxLeaves: 5000, maxDepth: 8 });
      const leaf = leaves.find(
        (candidate) =>
          normalizeText(candidate.value) === wanted || looseValue(candidate.value) === wantedLoose,
      );
      if (!leaf) continue;
      candidates.push({
        entryId: entry.id,
        score: 0.9 + 0.1 * recencyScore(entry, now),
        path: leaf.path,
        shape: "value",
        fields: [{ key: humanizeKey(leaf.key), path: [], aliases: [leaf.key], source: "api" }],
        method: match.method,
        url: entry.url,
        preview: leaf.value,
        reason: "exact value match",
      });
      continue;
    }

    for (const array of collectArrays(entry.body)) {
      const scoring = scoreList(array.value, snapshot, entry, now);
      if (scoring.score <= 0) continue;
      candidates.push({
        entryId: entry.id,
        score: scoring.score,
        path: array.path,
        shape: "list",
        fields: scoring.fields,
        joinKey: scoring.joinKey,
        method: match.method,
        url: entry.url,
        itemCount: array.value.length,
        preview: previewOf(array.value),
        reason: "list match",
      });
    }

    if (isPlainObject(entry.body)) {
      const leaves = scalarLeaves(entry.body, { maxLeaves: 5000, maxDepth: 8 });
      const values = new Set(
        leaves.map((leaf) => normalizeText(leaf.value)).filter((value) => value.length >= 2),
      );
      const domValues = domValueSet(snapshot).slice(0, 300);
      const hits = domValues.filter(
        (value) => values.has(value) || values.has(looseValue(value)),
      ).length;
      const overlap = domValues.length > 0 ? hits / domValues.length : 0;
      if (overlap > 0) {
        const fields = buildFields([entry.body], snapshot);
        candidates.push({
          entryId: entry.id,
          score: 0.4 * overlap + 0.05 * recencyScore(entry, now),
          path: [],
          shape: "object",
          fields,
          method: match.method,
          url: entry.url,
          preview: previewOf(entry.body),
          reason: "object match",
        });
      }
    }
  }

  const seen = new Set<string>();
  return candidates
    .filter((candidate) => {
      const signature = `${candidate.entryId}:${JSON.stringify(candidate.path)}`;
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export function bestApiCandidate(
  snapshot: DomSnapshot,
  entries: NetworkEntry[],
  minimumScore = 0.5,
): ApiCandidate | null {
  const [best] = rankApiCandidates(snapshot, entries, { limit: 1 });
  return best && best.score >= minimumScore ? best : null;
}

export { normalizeKey, normalizeText };