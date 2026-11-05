export type ProxyFailureKind = "challenge" | "blocked" | "timeout" | "error";

export type ProxyFailure = {
  kind: ProxyFailureKind;
  title: string;
  message: string;
};

const CHALLENGE_SIGNATURES = [
  "just a moment",
  "attention required",
  "performing security verification",
  "checking your browser",
  "enable javascript and cookies to continue",
  "verify you are human",
  "ddos protection by",
  "cf-browser-verification",
  "challenge-platform",
  "unusual traffic",
  "are you a robot",
  "complete the security check",
];

const BLOCKED_SIGNATURES = [
  "there was an error loading",
  "access denied",
  "request blocked",
  "403 forbidden",
  "you don't have permission to access",
  "this page isn't working",
];

function collect(doc: Document): string {
  const parts: string[] = [];
  try {
    parts.push(doc.title || "");
  } catch {
    /* ignore */
  }
  try {
    const body = doc.body?.innerText ?? "";
    parts.push(body.slice(0, 4000));
  } catch {
    /* ignore */
  }
  for (const selector of [
    "#challenge-form",
    "#cf-challenge-running",
    "#cf-please-wait",
    "iframe[src*='challenges.cloudflare.com']",
    "script[src*='challenge-platform']",
  ]) {
    try {
      if (doc.querySelector(selector)) parts.push("challenge");
    } catch {
      /* ignore */
    }
  }
  return parts.join("\n").toLowerCase();
}

export function detectProxyFailure(doc: Document | null): ProxyFailure | null {
  if (!doc) return null;
  const haystack = collect(doc);

  if (CHALLENGE_SIGNATURES.some((signature) => haystack.includes(signature))) {
    return {
      kind: "challenge",
      title: "This site is checking for a real browser",
      message:
        "A bot/CAPTCHA challenge (e.g. Cloudflare) is blocking the proxy. You can retry, or use a site that does not require it. Hosting the relay on a residential IP usually fixes this.",
    };
  }

  if (BLOCKED_SIGNATURES.some((signature) => haystack.includes(signature))) {
    return {
      kind: "blocked",
      title: "The site blocked the proxy",
      message:
        "This page refuses proxied browsers. It will not work through the live proxy right now.",
    };
  }

  return null;
}