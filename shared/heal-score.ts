export type HealKind = "click" | "fill" | "select" | "check" | "press" | "upload";

export type HealCandidate = {
  index: number;
  tag: string;
  role: string;
  text: string;
  ariaLabel: string;
  placeholder: string;
  name: string;
  testId: string;
  id: string;
  href: string;
  type: string;
  classes: string;
  path: string;
};

export type HealHints = {
  kind: HealKind;
  names: string[];
  role?: string;
};

const EXPECTED_TAGS: Record<HealKind, string[]> = {
  click: ["button", "a", "input", "div", "span", "label"],
  fill: ["input", "textarea", "select"],
  select: ["select"],
  check: ["input"],
  press: ["input", "textarea", "button"],
  upload: ["input"],
};

const EXPECTED_ROLES: Partial<Record<HealKind, string[]>> = {
  click: ["button", "link", "menuitem", "tab"],
  fill: ["textbox", "combobox", "searchbox"],
  select: ["combobox", "listbox"],
  check: ["checkbox", "radio", "switch"],
  upload: ["button"],
};

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tokens(value: string): Set<string> {
  const words = normalize(value)
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1);
  return new Set(words);
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const value of left) if (right.has(value)) shared += 1;
  return shared / (left.size + right.size - shared);
}

function bestFieldMatch(hint: string, candidate: HealCandidate): number {
  const wanted = normalize(hint);
  if (!wanted) return 0;

  const fields = [candidate.ariaLabel, candidate.placeholder, candidate.name, candidate.text, candidate.testId, candidate.id];
  let best = 0;
  for (const field of fields) {
    const value = normalize(field);
    if (!value) continue;
    if (value === wanted) return 1;
    if (value.includes(wanted) || wanted.includes(value)) best = Math.max(best, 0.8);
    best = Math.max(best, jaccard(tokens(wanted), tokens(value)));
  }
  return best;
}

/** Scores how likely a visible element is the one the recorded step meant. */
export function scoreCandidate(candidate: HealCandidate, hints: HealHints): number {
  const names = hints.names.filter((name) => normalize(name).length > 0);
  if (names.length === 0) return 0;

  let nameScore = 0;
  for (const name of names) nameScore += bestFieldMatch(name, candidate);
  nameScore = nameScore / names.length;

  let bonus = 0;
  if (EXPECTED_TAGS[hints.kind].includes(candidate.tag)) bonus += 0.15;
  const expectedRoles = EXPECTED_ROLES[hints.kind] ?? [];
  if (candidate.role && expectedRoles.includes(candidate.role)) bonus += 0.15;
  if (hints.kind === "fill" && candidate.tag === "input" && /^(hidden|submit|button|image|reset)$/i.test(candidate.type)) {
    bonus -= 0.4;
  }
  if (hints.kind === "check" && candidate.type !== "checkbox" && candidate.role !== "checkbox") bonus -= 0.3;
  if (hints.kind === "select" && candidate.tag !== "select" && candidate.role !== "combobox") bonus -= 0.3;
  if (hints.role && candidate.role && candidate.role !== hints.role) bonus -= 0.05;

  return Math.max(0, Math.min(1, nameScore + bonus));
}

export type HealChoice = {
  index: number;
  path: string;
  score: number;
};

/**
 * Chooses the best unique candidate. A minimum score and a margin over the
 * runner-up keep healing conservative: it is better to skip a click than to
 * click the wrong button.
 */
export function chooseCandidate(
  candidates: HealCandidate[],
  hints: HealHints,
  options: { minScore?: number; margin?: number } = {},
): HealChoice | null {
  const minScore = options.minScore ?? 0.52;
  const margin = options.margin ?? 0.08;

  const scored = candidates
    .map((candidate) => ({
      index: candidate.index,
      path: candidate.path,
      score: scoreCandidate(candidate, hints),
    }))
    .filter((candidate) => candidate.path.length > 0)
    .sort((left, right) => right.score - left.score);

  const best = scored[0];
  if (!best || best.score < minScore) return null;
  const second = scored[1];
  if (second && best.score - second.score < margin) return null;
  return best;
}
