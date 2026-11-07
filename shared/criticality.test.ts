import { describe, expect, it } from "vitest";
import { stepCriticality, type Step } from "./definition";

function step(overrides: Partial<Step>): Step {
  return {
    id: "step-1",
    enabled: true,
    optional: false,
    type: "click",
    selectors: [{ kind: "css", value: "button" }],
    ...overrides,
  } as Step;
}

describe("step criticality", () => {
  it("makes plain clicks skippable by default", () => {
    expect(stepCriticality(step({}))).toBe("preferred");
  });

  it("keeps inputs, selections, urls and extractions required", () => {
    expect(stepCriticality(step({ type: "goto", url: "https://example.com" } as Partial<Step>))).toBe("required");
    expect(
      stepCriticality(
        step({
          type: "fill",
          selectors: [{ kind: "css", value: "input" }],
          value: { mode: "literal", text: "x" },
        } as Partial<Step>),
      ),
    ).toBe("required");
    expect(stepCriticality(step({ type: "select", value: "x" } as Partial<Step>))).toBe("required");
    expect(stepCriticality(step({ type: "check", checked: true } as Partial<Step>))).toBe("required");
  });

  it("honours explicit criticality and the legacy optional flag", () => {
    expect(stepCriticality(step({ criticality: "required" }))).toBe("required");
    expect(stepCriticality(step({ optional: true }))).toBe("optional");
    expect(stepCriticality(step({ optional: true, criticality: "required" }))).toBe("required");
  });
});
