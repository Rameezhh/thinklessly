import { describe, expect, it } from "vitest";
import {
  classifyOverlayText,
  continueLabelsFor,
  dismissLabelsFor,
  isDangerousLabel,
  looksLikeChallenge,
  normalizeLabel,
} from "./obstructions";

describe("obstruction catalog", () => {
  it("classifies common overlays", () => {
    expect(classifyOverlayText("We use cookies to improve your experience")).toBe("consent");
    expect(classifyOverlayText("Subscribe to our newsletter")).toBe("newsletter");
    expect(classifyOverlayText("Choose your country and language")).toBe("region");
    expect(classifyOverlayText("You must be 18 or older")).toBe("age");
    expect(classifyOverlayText("Sign in to continue")).toBe("login");
    expect(classifyOverlayText("Install our mobile app")).toBe("app");
  });

  it("recognises real human checks", () => {
    expect(looksLikeChallenge("Enter the characters you see")).toBe(true);
    expect(looksLikeChallenge("Verify you are human")).toBe(true);
    expect(looksLikeChallenge("Type the characters shown")).toBe(true);
    expect(looksLikeChallenge("Free shipping on orders over $25")).toBe(false);
  });

  it("rejects labels that could perform the real action", () => {
    expect(isDangerousLabel("Place order")).toBe(true);
    expect(isDangerousLabel("Pay now")).toBe(true);
    expect(isDangerousLabel("Delete account")).toBe(true);
    expect(isDangerousLabel("Reject all")).toBe(false);
    expect(isDangerousLabel("No thanks")).toBe(false);
  });

  it("prefers rejecting consent and allows explicit continuation elsewhere", () => {
    expect(dismissLabelsFor("consent")).toContain("reject all");
    expect(dismissLabelsFor("consent")).not.toContain("accept all");
    expect(continueLabelsFor("region")).toContain("continue");
    expect(continueLabelsFor("consent")).toHaveLength(0);
  });

  it("normalizes labels", () => {
    expect(normalizeLabel("  No,  thanks! ")).toBe("no, thanks");
  });
});