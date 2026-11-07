import type { ApiField, PathSegment } from "./definition";
import {
  getPath,
  humanizeKey,
  isPlainObject,
  looseValue,
  normalizeKey,
  normalizeText,
  scalarLeaves,
  scalarString,
} from "./api-values";
import type { DomSnapshot } from "./api-match";

export function itemValues(items: unknown[]): Set<string> {
  const values = new Set<string>();
  for (const item of items.slice(0, 100)) {
    for (const leaf of scalarLeaves(item, { maxLeaves: 300, maxDepth: 5 })) {
      const normalized = normalizeText(leaf.value);
      if (normalized.length < 1) continue;
      if (normalized.length >= 2) values.add(normalized);
      const loose = looseValue(leaf.value);
      if (loose.length >= 2) values.add(loose);
    }
  }
  return values;
}

export function itemKeySet(items: unknown[]): Set<string> {
  const keys = new Set<string>();
  for (const item of items.slice(0, 20)) {
    if (!isPlainObject(item)) continue;
    for (const key of Object.keys(item)) keys.add(normalizeKey(key));
  }
  return keys;
}

function leafEntries(item: unknown): { path: PathSegment[]; key: string; value: string }[] {
  return scalarLeaves(item, { maxLeaves: 120, maxDepth: 4 })
    .filter((leaf) => leaf.value.trim().length > 0)
    .map((leaf) => ({ path: leaf.path, key: leaf.key, value: leaf.value }));
}

export function buildFields(items: unknown[], snapshot: DomSnapshot): ApiField[] {
  const first = items.find(isPlainObject);
  if (!first) return [];
  const leaves = leafEntries(first);
  const headers = (snapshot.headers ?? []).map((header) => header.trim()).filter(Boolean);
  const fields: ApiField[] = [];
  const usedPaths = new Set<string>();
  const usedKeys = new Set<string>();

  const nextKey = (label: string, alias: string): string => {
    let key = humanizeKey(label || alias, "field");
    let suffix = 2;
    while (usedKeys.has(key)) {
      key = `${humanizeKey(label || alias, "field")}_${suffix}`;
      suffix += 1;
    }
    usedKeys.add(key);
    return key;
  };

  const addField = (label: string, path: PathSegment[], alias: string): void => {
    const signature = JSON.stringify(path);
    if (usedPaths.has(signature) || fields.length >= 120) return;
    usedPaths.add(signature);
    fields.push({
      key: nextKey(label, alias),
      label: label || alias,
      path,
      aliases: [alias, label].filter(Boolean),
      source: "api",
    });
  };

  const addDomField = (label: string, index: number): void => {
    if (fields.length >= 120) return;
    fields.push({
      key: nextKey(label, label),
      label,
      path: [],
      aliases: [label],
      source: "dom",
      domSelector: `:scope > td:nth-child(${index + 1}), :scope > th:nth-child(${index + 1})`,
    });
  };

  if (headers.length > 0) {
    const firstRow = snapshot.rows?.[0] ?? [];
    headers.forEach((header, index) => {
      let best = leaves[0];
      let bestScore = -1;
      const wantedKey = normalizeKey(header);
      const wantedValue = normalizeText(firstRow[index] ?? "");
      for (const leaf of leaves) {
        let score = 0;
        if (normalizeKey(leaf.key) === wantedKey) score += 4;
        else if (normalizeKey(leaf.key).includes(wantedKey) || wantedKey.includes(normalizeKey(leaf.key))) score += 2;
        if (wantedValue && normalizeText(leaf.value) === wantedValue) score += 3;
        if (score > bestScore) {
          best = leaf;
          bestScore = score;
        }
      }
      if (best && bestScore > 0) addField(header, best.path, best.key);
      else addDomField(header || `column_${index + 1}`, index);
    });
    return fields;
  }

  for (const leaf of leaves) addField(humanizeKey(leaf.key), leaf.path, leaf.key);
  return fields;
}

export function joinKeyFor(items: unknown[], fields: ApiField[]): string | undefined {
  let best: { key: string; unique: number } | undefined;
  for (const field of fields) {
    const values = new Set<string>();
    let empties = 0;
    for (const item of items.slice(0, 100)) {
      const raw = getPath(item, field.path);
      const text = scalarString(raw);
      if (!text || text.trim() === "") empties += 1;
      else values.add(normalizeText(text));
    }
    if (empties > 0 || values.size < 2) continue;
    if (!best || values.size > best.unique) best = { key: field.key, unique: values.size };
  }
  return best?.key;
}