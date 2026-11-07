export type ObstructionKind =
  | "consent"
  | "newsletter"
  | "modal"
  | "interstitial"
  | "region"
  | "age"
  | "app"
  | "login";

export type OverlayMatcher = { selector: string; kind: ObstructionKind };

/**
 * Known overlay containers. Order matters: specific vendor selectors come before
 * generic ones so the kind is classified correctly.
 */
export const OVERLAY_MATCHERS: OverlayMatcher[] = [
  // Consent / CMPs
  { selector: "#onetrust-banner-sdk, #onetrust-consent-sdk", kind: "consent" },
  { selector: "#CybotCookiebotDialog, #CookiebotWidget", kind: "consent" },
  { selector: "#truste-consent-track, .truste_overlay", kind: "consent" },
  { selector: ".qc-cmp2-container, #qc-cmp2-ui", kind: "consent" },
  { selector: ".osano-cm-window, .osano-cm-dialog", kind: "consent" },
  { selector: "#usercentrics-root, #uc-center-container", kind: "consent" },
  { selector: "#didomi-host, .didomi-popup-container", kind: "consent" },
  { selector: ".klaro .cookie-modal, .klaro .cookie-notice", kind: "consent" },
  { selector: "#hs-eu-cookie-confirmation", kind: "consent" },
  { selector: "[id*='cookie' i], [class*='cookie' i]", kind: "consent" },
  { selector: "[id*='consent' i], [class*='consent' i]", kind: "consent" },
  { selector: "[id*='gdpr' i], [class*='gdpr' i]", kind: "consent" },

  // Amazon surfaces
  { selector: "#a-popover-root, .a-popover-wrapper", kind: "modal" },
  { selector: "#nav-flyout-ya-signin", kind: "login" },
  { selector: "#nav-global-location-popover, #nav-global-location-slot", kind: "region" },
  { selector: "#nav-signin-tooltip", kind: "login" },

  // Common site prompts
  { selector: "[id*='newsletter' i], [class*='newsletter' i]", kind: "newsletter" },
  { selector: "[id*='subscribe' i], [class*='subscribe' i]", kind: "newsletter" },
  { selector: "[id*='age-gate' i], [class*='age-gate' i], [class*='agegate' i]", kind: "age" },
  { selector: "[id*='region' i], [class*='region' i]", kind: "region" },
  { selector: "[id*='locale' i], [class*='locale' i]", kind: "region" },
  { selector: "[id*='country' i], [class*='country' i]", kind: "region" },
  { selector: "[class*='app-banner' i], [class*='smart-banner' i]", kind: "app" },
  { selector: "[class*='install-app' i]", kind: "app" },
  { selector: "[id*='login' i][role='dialog'], [class*='login' i][role='dialog']", kind: "login" },

  // Generic dialogs/popups last
  { selector: "[role='dialog'], [role='alertdialog'], [aria-modal='true']", kind: "modal" },
  { selector: "[class*='interstitial' i]", kind: "interstitial" },
  { selector: "[class*='modal' i], [class*='overlay' i], [class*='backdrop' i]", kind: "modal" },
  { selector: "[class*='popup' i], [class*='popover' i]", kind: "modal" },
];

export const CLOSE_SELECTORS: string[] = [
  "[aria-label*='close' i]",
  "[aria-label*='dismiss' i]",
  "[title*='close' i]",
  "[data-testid*='close' i]",
  "[data-testid*='dismiss' i]",
  "[data-action*='close' i]",
  "[data-dismiss]",
  ".a-popover-close, #a-popover-close",
  "button[class*='close' i]",
  "[class*='close' i]",
  "[class*='dismiss' i]",
];

/**
 * Real human/bot checks. These are never auto-clicked. Only unambiguous
 * challenge containers live here; passive widgets (e.g. the invisible reCAPTCHA
 * v3 badge) are in CHALLENGE_HINT_SELECTORS and need matching text too.
 */
export const CHALLENGE_SELECTORS: string[] = [
  "iframe[src*='recaptcha'][src*='bframe']",
  "iframe[src*='recaptcha'][src*='anchor']:not([src*='size=invisible'])",
  "iframe[src*='hcaptcha']",
  "iframe[src*='turnstile']",
  "iframe[src*='arkose']",
  "iframe[src*='friendlycaptcha']",
  "iframe[src*='challenges.cloudflare.com']",
  "#challenge-form",
  "#cf-challenge-running",
  "#challenge-stage",
  "#captchacharacters",
  "form[action*='validateCaptcha']",
  "input[name*='captcha' i]",
];

/** Weak hints: only treated as a challenge together with challenge text. */
export const CHALLENGE_HINT_SELECTORS: string[] = [
  "img[src*='captcha' i]",
  "[id*='captcha' i]",
  "[class*='captcha' i]",
  "[data-sitekey]",
  "[data-callback*='captcha' i]",
];

export const CHALLENGE_TEXT_PATTERNS: RegExp[] = [
  /verify (that )?you are (a )?human/i,
  /are you a (robot|human)/i,
  /i'?m not a robot/i,
  /human verification/i,
  /unusual traffic/i,
  /checking your browser/i,
  /enter the characters (you see|shown)/i,
  /type the characters (you see|shown)/i,
  /solve (this|the) (puzzle|captcha)/i,
  /press (and|&) hold/i,
  /complete the security check/i,
  /confirm you are human/i,
  /bot (detection|verification)/i,
  /automated (access|queries|traffic)/i,
  /suspicious activity/i,
  /too many requests/i,
];

const DANGEROUS_LABELS = [
  "pay",
  "place order",
  "place your order",
  "buy now",
  "purchase",
  "checkout",
  "delete",
  "remove",
  "unsubscribe",
  "sign out",
  "log out",
  "logout",
  "submit",
  "confirm order",
  "cancel order",
  "transfer",
  "withdraw",
  "deactivate",
  "block",
  "report",
  "send payment",
  "donate",
  "order now",
];

const DISMISS_LABELS: Record<ObstructionKind, string[]> = {
  consent: [
    "reject all",
    "reject",
    "decline",
    "deny",
    "refuse",
    "only necessary",
    "necessary only",
    "essential only",
    "use necessary cookies only",
    "continue without accepting",
    "no thanks",
    "not now",
    "close",
    "dismiss",
    "×",
    "✕",
  ],
  newsletter: [
    "no thanks",
    "no, thanks",
    "not now",
    "maybe later",
    "remind me later",
    "i'll do it later",
    "not interested",
    "dismiss",
    "close",
    "×",
    "✕",
    "no",
  ],
  modal: ["close", "dismiss", "not now", "no thanks", "maybe later", "later", "got it", "×", "✕"],
  interstitial: ["continue shopping", "no thanks", "not now", "skip", "close", "dismiss", "×", "✕"],
  region: ["stay on page", "stay", "close", "dismiss", "no thanks", "not now", "×", "✕"],
  age: ["exit", "leave", "no", "no thanks", "close", "×", "✕"],
  app: ["not now", "no thanks", "maybe later", "continue in browser", "stay on web", "close", "×", "✕"],
  login: ["not now", "no thanks", "maybe later", "continue as guest", "skip", "close", "dismiss", "×", "✕"],
};

const CONTINUE_LABELS: Record<ObstructionKind, string[]> = {
  consent: [],
  newsletter: [],
  modal: [],
  interstitial: [
    "continue",
    "continue to site",
    "continue to website",
    "go to site",
    "go to website",
    "enter site",
    "enter website",
    "proceed",
    "view site",
  ],
  region: ["continue", "continue to site", "go to site", "go to website", "shop now", "take me there", "enter"],
  age: ["yes", "i am 18", "i'm 18", "i am over 18", "i'm over 18", "yes, i am 18", "enter", "continue"],
  app: ["continue", "open in app"],
  login: ["continue as guest", "skip", "not now"],
};

const CONSENT_CONTINUE_LABELS = ["accept all", "accept", "agree", "i agree", "allow all", "ok", "got it"];

export function normalizeLabel(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[.!?…]+$/g, "")
    .trim();
}

export function isDangerousLabel(value: string): boolean {
  const label = normalizeLabel(value);
  if (!label) return true;
  const padded = ` ${label} `;
  return DANGEROUS_LABELS.some((danger) => padded.includes(` ${normalizeLabel(danger)} `));
}

export function dismissLabelsFor(kind: ObstructionKind): string[] {
  return DISMISS_LABELS[kind];
}

export function continueLabelsFor(kind: ObstructionKind): string[] {
  return CONTINUE_LABELS[kind];
}

export function consentContinueLabels(): string[] {
  return CONSENT_CONTINUE_LABELS;
}

export function looksLikeChallenge(text: string): boolean {
  return CHALLENGE_TEXT_PATTERNS.some((pattern) => pattern.test(text));
}

export function classifyOverlayText(text: string): ObstructionKind {
  const value = text.toLowerCase();
  if (/cookie|consent|gdpr|privacy choices|tracking/.test(value)) return "consent";
  if (/newsletter|subscribe|mailing list|inbox/.test(value)) return "newsletter";
  if (/\bage\b|\b18\b|date of birth|old enough|legal drinking|years old/.test(value)) return "age";
  if (/country|region|locale|ship to|shipping to|deliver to/.test(value)) return "region";
  if (/sign in|log in|login|create an account|register/.test(value)) return "login";
  if (/install|open in app|download the app|mobile app/.test(value)) return "app";
  if (/continue|before you continue|welcome|just a moment/.test(value)) return "interstitial";
  return "modal";
}