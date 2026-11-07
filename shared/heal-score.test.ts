import { describe, expect, it } from "vitest";
import { chooseCandidate, scoreCandidate, type HealCandidate, type HealHints } from "./heal-score";

function candidate(overrides: Partial<HealCandidate>): HealCandidate {
  return {
    index: 0,
    tag: "button",
    role: "",
    text: "",
    ariaLabel: "",
    placeholder: "",
    name: "",
    testId: "",
    id: "",
    href: "",
    type: "",
    classes: "",
    path: "button",
    ...overrides,
  };
}

const clickHints: HealHints = { kind: "click", names: ["Add to cart"] };

describe("heal scoring", () => {
  it("scores the matching button over an unrelated one", () => {
    const match = candidate({ index: 0, text: "Add to Cart", path: "button:nth-of-type(1)" });
    const other = candidate({ index: 1, text: "Buy Now", path: "button:nth-of-type(2)" });
    expect(scoreCandidate(match, clickHints)).toBeGreaterThan(scoreCandidate(other, clickHints));
  });

  it("chooses the unique best candidate", () => {
    const choice = chooseCandidate(
      [
        candidate({ index: 0, text: "Add to Cart", path: "button:nth-of-type(1)" }),
        candidate({ index: 1, text: "Help", path: "a:nth-of-type(2)" }),
      ],
      clickHints,
    );
    expect(choice?.path).toBe("button:nth-of-type(1)");
    expect(choice?.score).toBeGreaterThan(0.5);
  });

  it("returns null when two candidates are equally plausible", () => {
    const choice = chooseCandidate(
      [
        candidate({ index: 0, text: "Add to Cart", path: "button:nth-of-type(1)" }),
        candidate({ index: 1, text: "Add to Cart", path: "button:nth-of-type(2)" }),
      ],
      clickHints,
    );
    expect(choice).toBeNull();
  });

  it("prefers an input by placeholder for fills", () => {
    const hints: HealHints = { kind: "fill", names: ["Email"] };
    const choice = chooseCandidate(
      [
        candidate({ index: 0, tag: "input", placeholder: "Email address", path: "input:nth-of-type(1)" }),
        candidate({ index: 1, tag: "input", placeholder: "Password", path: "input:nth-of-type(2)", type: "password" }),
      ],
      hints,
    );
    expect(choice?.path).toBe("input:nth-of-type(1)");
  });
});
