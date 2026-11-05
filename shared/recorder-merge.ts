import type { Step } from "./definition";

export type MergeResult = {
  steps: Step[];
  updated: boolean;
  stepId: string;
};

export function isValueStep(step: Step): boolean {
  return step.type === "fill" || step.type === "select" || step.type === "check";
}

export function stepElementKey(step: Step): string | null {
  if (!("selectors" in step) || !step.selectors || step.selectors.length === 0) return null;
  const selector = step.selectors[0];
  if (!selector) return null;
  return `${step.type}:${selector.kind}:${selector.value}:${selector.name ?? ""}`;
}

/**
 * Keeps one value-bearing step per element. When a user types, clears, retypes,
 * or toggles the same control again, the recorded step is replaced with the
 * latest value instead of appending a duplicate.
 */
export function mergeRecordedStep(steps: Step[], step: Step): MergeResult {
  if (!isValueStep(step)) {
    return { steps: [...steps, step], updated: false, stepId: step.id };
  }

  const key = stepElementKey(step);
  if (!key) {
    return { steps: [...steps, step], updated: false, stepId: step.id };
  }

  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const current = steps[index];
    if (!current || !isValueStep(current)) continue;
    if (stepElementKey(current) !== key) continue;

    const next = [...steps];
    next[index] = { ...step, id: current.id } as Step;
    return { steps: next, updated: true, stepId: current.id };
  }

  return { steps: [...steps, step], updated: false, stepId: step.id };
}
