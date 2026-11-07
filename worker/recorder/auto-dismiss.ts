/**
 * Runs inside a proxied live page. It closes only clearly benign obstructions
 * (cookie/consent, newsletter, app banners, region/age interstitials) and never
 * touches human verification. Clicks are flagged so the recorder does not save
 * them as steps.
 */
export function autoDismissInitScript(): string {
  return `(() => {
  const w = window;
  if (w.__thinklesslyAutoDismissInstalled) return;
  w.__thinklesslyAutoDismissInstalled = true;

  const OVERLAYS = [
    "#onetrust-banner-sdk", "#onetrust-consent-sdk", "#CybotCookiebotDialog",
    ".qc-cmp2-container", ".osano-cm-window", "#usercentrics-root", "#didomi-host",
    ".klaro .cookie-modal", ".klaro .cookie-notice", "#hs-eu-cookie-confirmation",
    "#a-popover-root", ".a-popover-wrapper", "#nav-flyout-ya-signin",
    "[role='dialog']", "[role='alertdialog']", "[aria-modal='true']",
    "[id*='cookie' i]", "[class*='cookie' i]",
    "[id*='consent' i]", "[class*='consent' i]",
    "[id*='newsletter' i]", "[class*='newsletter' i]",
    "[class*='age-gate' i]", "[class*='agegate' i]",
    "[class*='region' i]", "[class*='locale' i]", "[class*='country' i]",
    "[class*='interstitial' i]", "[class*='modal' i]", "[class*='popup' i]"
  ];

  const CHALLENGE = [
    "iframe[src*='recaptcha'][src*='bframe']",
    "iframe[src*='recaptcha'][src*='anchor']:not([src*='size=invisible'])",
    "iframe[src*='hcaptcha']", "iframe[src*='turnstile']",
    "iframe[src*='challenges.cloudflare.com']", "#challenge-form", "#cf-challenge-running",
    "#captchacharacters", "form[action*='validateCaptcha']"
  ];

  const CHALLENGE_TEXT = /verify (that )?you are (a )?human|are you a (robot|human)|i'?m not a robot|unusual traffic|checking your browser|enter the characters|type the characters|press (and|&) hold|complete the security check|human verification/i;

  const DISMISS = [
    "reject all", "reject", "decline", "deny", "refuse", "only necessary",
    "necessary only", "essential only", "use necessary cookies only",
    "continue without accepting", "no thanks", "no, thanks", "not now",
    "maybe later", "remind me later", "i'll do it later", "not interested",
    "got it", "skip", "skip for now", "continue shopping", "stay on page",
    "stay", "continue in browser", "stay on web", "dismiss", "close", "×", "✕"
  ];

  const CONTINUE = [
    "continue", "continue to site", "continue to website", "go to site",
    "go to website", "enter site", "enter website", "proceed",
    "yes", "yes, i am 18", "i am 18", "i'm over 18", "i am over 18", "enter"
  ];

  const DANGER = [
    "pay", "place order", "place your order", "buy", "buy now", "purchase",
    "checkout", "delete", "remove", "unsubscribe", "sign out", "log out",
    "logout", "submit", "confirm order", "cancel order", "transfer",
    "withdraw", "deactivate", "block", "report", "donate", "order now"
  ];

  const INTERSTITIAL = /country|region|locale|shipping|ship to|deliver to|age|18\\+|before you continue|welcome|select your|choose your/i;

  function visible(el) {
    try {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 1 && rect.height > 1 && style.display !== "none" &&
        style.visibility !== "hidden" && Number(style.opacity || "1") > 0;
    } catch {
      return false;
    }
  }

  function textOf(el) {
    const input = el;
    return String(
      (el.innerText || input.value || el.getAttribute("aria-label") || el.getAttribute("title") || "")
    ).replace(/\\s+/g, " ").trim().slice(0, 120).toLowerCase();
  }

  function dangerous(label) {
    return !label || DANGER.some((word) => label === word || label.indexOf(" " + word + " ") >= 0);
  }

  function challengePresent() {
    for (const selector of CHALLENGE) {
      try {
        if (Array.from(document.querySelectorAll(selector)).some(visible)) return true;
      } catch {}
    }
    try {
      return CHALLENGE_TEXT.test((document.body ? document.body.innerText : "").slice(0, 4000));
    } catch {
      return false;
    }
  }

  function click(el) {
    try {
      w.__thinklesslyObstructionDismissing = true;
      el.click();
      setTimeout(() => { w.__thinklesslyObstructionDismissing = false; }, 80);
      return true;
    } catch {
      w.__thinklesslyObstructionDismissing = false;
      return false;
    }
  }

  function insideUi(el) {
    try {
      return Boolean(el.closest("[data-thinklessly-ui]"));
    } catch {
      return false;
    }
  }

  function attempt() {
    if (w.__thinklesslyPickMode) return;
    if (challengePresent()) return;
    for (const selector of OVERLAYS) {
      let nodes = [];
      try {
        nodes = Array.from(document.querySelectorAll(selector)).slice(0, 4);
      } catch {
        continue;
      }
      for (const overlay of nodes) {
        if (!visible(overlay) || insideUi(overlay)) continue;
        const rect = overlay.getBoundingClientRect();
        const style = getComputedStyle(overlay);
        const floating = style.position === "fixed" || style.position === "absolute" ||
          (Number.parseInt(style.zIndex || "0", 10) || 0) > 0;
        if (!floating) continue;
        if (rect.width * rect.height < 4000) continue;

        const overlayText = String(overlay.innerText || "").slice(0, 1500).toLowerCase();

        const close = overlay.querySelector(
          "[aria-label*='close' i],[aria-label*='dismiss' i],[title*='close' i],[data-testid*='close' i],[class*='close' i]"
        );
        if (close && visible(close) && !dangerous(textOf(close)) && !insideUi(close)) {
          if (click(close)) return;
        }

        const controls = Array.from(
          overlay.querySelectorAll("button,a,[role='button'],input[type='submit'],input[type='button']")
        ).filter(visible);

        const labels = INTERSTITIAL.test(overlayText) ? DISMISS.concat(CONTINUE) : DISMISS;
        for (const label of labels) {
          const control = controls.find((el) => {
            const text = textOf(el);
            if (dangerous(text) || insideUi(el)) return false;
            return text === label || (label.length >= 4 && text.indexOf(label) >= 0);
          });
          if (control && click(control)) return;
        }
      }
    }
  }

  function start() {
    attempt();
    setTimeout(attempt, 500);
    setTimeout(attempt, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    attempt();
    if (tries > 25) clearInterval(timer);
  }, 1200);
})();`;
}