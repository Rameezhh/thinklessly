import { CHALLENGE_SELECTORS, looksLikeChallenge } from "@shared/obstructions";

export type ProxyFailureKind = "challenge" | "blocked" | "timeout" | "error";

export type ProxyFailure = {
  kind: ProxyFailureKind;
  title: string;
  message: string;
};

const BLOCKED_SIGNATURES = [
  "there was an error loading",
  "access denied",
  "request blocked",
  "403 forbidden",
  "you don't have permission to access",
  "this page isn't working",
];

function isVisible(element: Element): boolean {
  try {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return (
      rect.width > 1 &&
      rect.height > 1 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0"
    );
  } catch {
    return false;
  }
}

function collect(doc: Document): string {
  const parts: string[] = [];
  try {
    parts.push(doc.title || "");
  } catch {
    /* ignore */
  }
  try {
    parts.push((doc.body?.innerText ?? "").slice(0, 4000));
  } catch {
    /* ignore */
  }
  return parts.join("\n").toLowerCase();
}

function hasVisibleChallenge(doc: Document): boolean {
  for (const selector of CHALLENGE_SELECTORS) {
    try {
      const nodes = doc.querySelectorAll(selector);
      for (const node of Array.from(nodes).slice(0, 4)) {
        if (isVisible(node)) return true;
      }
    } catch {
      // Invalid selector for this document; ignore.
    }
  }
  return false;
}

export function detectProxyFailure(doc: Document | null): ProxyFailure | null {
  if (!doc) return null;
  const haystack = collect(doc);

  if (hasVisibleChallenge(doc) || looksLikeChallenge(haystack)) {
    return {
      kind: "challenge",
      title: "This site is checking the browser",
      message:
        "Finish the check (for example Continue, a captcha, or “yes I’m human”) directly in the page. Recording keeps running. If the page stays blank, use Retry or Reset proxy.",
    };
  }

  if (BLOCKED_SIGNATURES.some((signature) => haystack.includes(signature))) {
    return {
      kind: "blocked",
      title: "The site blocked the proxy",
      message:
        "This page refuses proxied browsers. Switch to the real-browser recorder from the automation page, or retry with Reset proxy.",
    };
  }

  return null;
}