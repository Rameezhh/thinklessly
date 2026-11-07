import { describe, expect, it } from "vitest";
import type { Step } from "./definition";
import { mergeRecordedStep } from "./recorder-merge";

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

function secretFill(id: string, value = "input[name=password]"): Step {
  return {
    id,
    type: "fill",
    enabled: true,
    optional: false,
    selectors: [{ kind: "css", value }],
    value: { mode: "field", key: "password" },
    secret: true,
    identity: "t1:input|login|password",
    label: "Fill Password (secret)",
  };
}

function literalFill(id: string, text: string, identity: string, value = "input[name=password]"): Step {
  return {
    id,
    type: "fill",
    enabled: true,
    optional: false,
    selectors: [{ kind: "css", value }],
    value: { mode: "literal", text },
    identity,
    label: "Fill Password",
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

describe("password / identity merging", () => {
  it("never downgrades a secret step when the password is revealed", () => {
    const first = mergeRecordedStep([], secretFill("step-1"));
    const revealed = mergeRecordedStep(
      first.steps,
      literalFill("step-2", "hunter2", "t1:input|login|password", "input[name=password][type=text]"),
    );

    expect(revealed.ignored).toBe(true);
    expect(revealed.steps).toHaveLength(1);
    expect(revealed.steps[0]).toMatchObject({
      id: "step-1",
      value: { mode: "field", key: "password" },
      secret: true,
    });
  });

  it("merges edits even when the selector changed but the identity is the same", () => {
    const identity = "t1:input|login|email";
    const first = mergeRecordedStep([], literalFill("step-1", "a@b.com", identity, "input#email"));
    const second = mergeRecordedStep(
      first.steps,
      literalFill("step-2", "sam@example.com", identity, "input[name=email]"),
    );

    expect(second.steps).toHaveLength(1);
    expect(second.steps[0]).toMatchObject({
      id: "step-1",
      value: { mode: "literal", text: "sam@example.com" },
      selectors: [{ kind: "css", value: "input[name=email]" }],
    });
  });

  it("upgrades a literal step to a secret step", () => {
    const identity = "t1:input|login|password";
    const first = mergeRecordedStep([], literalFill("step-1", "hunter2", identity));
    const second = mergeRecordedStep(first.steps, secretFill("step-2"));

    expect(second.steps).toHaveLength(1);
    expect(second.steps[0]).toMatchObject({ id: "step-1", secret: true, value: { mode: "field" } });
  });
});
