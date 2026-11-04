import { describe, expect, it } from "vitest";
import type { Step } from "@shared/definition";
import { mergeRecordedStep } from "./merge";

function fill(id: string, text: string, value = "input[name=email]"): Step {
  return {
    id,
    type: "fill",
    enabled: true,
    optional: false,
    selectors: [{ kind: "css", value }],
    value: { mode: "literal", text },
    label: "Fill Email",
  };
}

function check(id: string, checked: boolean, value = "input[name=terms]"): Step {
  return {
    id,
    type: "check",
    enabled: true,
    optional: false,
    selectors: [{ kind: "css", value }],
    checked,
    label: "Check Terms",
  };
}

describe("mergeRecordedStep", () => {
  it("keeps the latest value when the same input is edited again", () => {
    const first = mergeRecordedStep([], fill("step-1", "sam"));
    const second = mergeRecordedStep(first.steps, fill("step-2", "sam@example.com"));

    expect(second.steps).toHaveLength(1);
    expect(second.updated).toBe(true);
    expect(second.stepId).toBe("step-1");
    expect(second.steps[0]).toMatchObject({
      id: "step-1",
      value: { mode: "literal", text: "sam@example.com" },
    });
  });

  it("keeps the latest checkbox state", () => {
    const first = mergeRecordedStep([], check("step-1", true));
    const second = mergeRecordedStep(first.steps, check("step-2", false));

    expect(second.steps).toHaveLength(1);
    expect(second.steps[0]).toMatchObject({ id: "step-1", checked: false });
  });

  it("keeps separate elements and non-value steps", () => {
    let steps: Step[] = [];
    steps = mergeRecordedStep(steps, fill("step-1", "a")).steps;
    steps = mergeRecordedStep(steps, fill("step-2", "b", "input[name=name]")).steps;
    steps = mergeRecordedStep(steps, {
      id: "step-3",
      type: "click",
      enabled: true,
      optional: false,
      selectors: [{ kind: "css", value: "button" }],
    }).steps;

    expect(steps).toHaveLength(3);
    expect(steps.map((step) => step.id)).toEqual(["step-1", "step-2", "step-3"]);
  });
});
