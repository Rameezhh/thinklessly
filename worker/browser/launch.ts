import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { PlaywrightBlocker } from "@ghostery/adblocker-playwright";
import { chromium, type Browser, type BrowserContext } from "playwright";

export const STEALTH_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--disable-client-side-phishing-detection",
  "--no-first-run",
];

const STEALTH_SCRIPT = `
Object.defineProperty(navigator, "webdriver", { get: () => undefined });
Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
window.chrome = window.chrome || { runtime: {} };
`;

export type BrowserSession = {
  browser: Browser | undefined;
  context: BrowserContext;
  close: () => Promise<void>;
};

export type OpenBrowserOptions = {
  headless: boolean;
  profileKey?: string;
  viewport?: { width: number; height: number } | null;
  userAgent?: string;
  locale?: string;
  timezone?: string;
  extraArgs?: string[];
};

function profileRoot(): string {
  return process.env.BROWSER_PROFILE_DIR?.trim() || resolve("data", "profiles");
}

function safeKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "default";
}

let blockerPromise: Promise<PlaywrightBlocker | null> | undefined;

/**
 * Loads a locally cached filter list. No network call happens at run time:
 * run `pnpm adblock:fetch` once to populate `data/adblock/list.txt`. If the
 * cache is missing, ad blocking is simply disabled.
 */
function loadBlocker(): Promise<PlaywrightBlocker | null> {
  if (blockerPromise) return blockerPromise;
  blockerPromise = (async () => {
    if (process.env.ADBLOCK_DISABLED === "true") return null;
    const path = process.env.ADBLOCK_LIST_PATH?.trim() || resolve("data", "adblock", "list.txt");
    try {
      const text = await readFile(path, "utf8");
      if (!text.trim()) return null;
      return PlaywrightBlocker.parse(text);
    } catch {
      return null;
    }
  })();
  return blockerPromise;
}

async function enableBlocking(context: BrowserContext): Promise<void> {
  const blocker = await loadBlocker().catch(() => null);
  if (!blocker) return;
  const enable = (page: import("playwright").Page) => {
    void blocker.enableBlockingInPage(page).catch(() => undefined);
  };
  for (const page of context.pages()) enable(page);
  context.on("page", enable);
}

/**
 * Opens Chromium with a persistent per-automation profile and small stealth
 * patches. Persistent profiles keep cookies/logins between runs, which is what
 * makes real-world sites (Amazon, marketplaces, dashboards) practical.
 */
export async function openBrowser(options: OpenBrowserOptions): Promise<BrowserSession> {
  const args = [...STEALTH_ARGS, ...(options.extraArgs ?? [])];

  if (options.profileKey) {
    const dir = join(profileRoot(), safeKey(options.profileKey));
    await mkdir(dir, { recursive: true });
    const context = await chromium.launchPersistentContext(dir, {
      headless: options.headless,
      viewport: options.viewport === undefined ? undefined : options.viewport,
      userAgent: options.userAgent,
      locale: options.locale,
      timezoneId: options.timezone,
      args,
    });
    await context.addInitScript({ content: STEALTH_SCRIPT });
    await enableBlocking(context);
    return {
      browser: context.browser() ?? undefined,
      context,
      close: async () => {
        await context.close().catch(() => undefined);
      },
    };
  }

  const browser = await chromium.launch({ headless: options.headless, args });
  const context = await browser.newContext({
    viewport: options.viewport === undefined ? undefined : options.viewport,
    userAgent: options.userAgent,
    locale: options.locale,
    timezoneId: options.timezone,
  });
  await context.addInitScript({ content: STEALTH_SCRIPT });
  await enableBlocking(context);
  return {
    browser,
    context,
    close: async () => {
      await context.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
    },
  };
}