import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openBrowser } from "../worker/browser/launch";
import { autoDismissInitScript } from "../worker/recorder/auto-dismiss";
import { dismissObstructions } from "../worker/runner/obstruction";

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const html = readFileSync(resolve("public", "demo-obstructions.html"), "utf8");
  const url = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  const logs: string[] = [];
  const log = async (level: string, message: string) => {
    logs.push(`${level}: ${message}`);
  };

  const session = await openBrowser({ headless: true, profileKey: "smoke" });
  try {
    const page = session.context.pages()[0] ?? (await session.context.newPage());
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(350);

    const result = await dismissObstructions(page, log, "smoke", {
      allowContinue: true,
      allowAcceptConsent: false,
    });

    if (!result.challenge) fail("challenge was not detected");
    if (!(await page.locator("#consent").isHidden())) fail("cookie consent was not dismissed");
    if (!(await page.locator("#newsletter").isHidden())) fail("newsletter was not dismissed");
    if (!(await page.locator("#region").isHidden())) fail("region prompt was not dismissed");
    if (!(await page.locator("#challenge").isVisible())) fail("human check should stay visible");
    const challengeClicked = await page.evaluate(() => Boolean((window as { __challengeClicked?: boolean }).__challengeClicked));
    if (challengeClicked) fail("human check was clicked");
    if (!logs.some((line) => line.includes("human check"))) fail("no challenge log");

    console.log("RUNNER OBSTRUCTION SMOKE OK");
    for (const line of logs) console.log(`  ${line}`);

    const interstitialPage = await session.context.newPage();
    const interstitialHtml = `<!doctype html><html><body>
      <h1>Before you continue</h1>
      <p>Choose your region and language.</p>
      <button id="go" type="button">Continue</button>
      <script>document.getElementById("go").onclick = () => { window.__goClicked = true; };</script>
    </body></html>`;
    await interstitialPage.goto(
      `data:text/html;charset=utf-8,${encodeURIComponent(interstitialHtml)}`,
      { waitUntil: "domcontentloaded" },
    );
    const interstitial = await dismissObstructions(interstitialPage, log, "interstitial");
    if (!interstitial.dismissed) fail("page interstitial was not dismissed");
    const goClicked = await interstitialPage.evaluate(() =>
      Boolean((window as { __goClicked?: boolean }).__goClicked),
    );
    if (!goClicked) fail("page interstitial Continue was not clicked");
    await interstitialPage.close();
    console.log("PAGE INTERSTITIAL SMOKE OK");

    // A custom floating layer with no known class/id must be found by the
    // top-layer scan (this also exercises the __name patch in evaluate).
    const customPage = await session.context.newPage();
    const customHtml = `<!doctype html><html><body>
      <div id="zzz" style="position:fixed;left:25%;top:25%;width:50%;height:50%;z-index:9999;
        display:flex;align-items:center;justify-content:center;gap:12px;background:#fff;border:1px solid #ccc;">
        <span>Special offer</span>
        <button id="custom-close" type="button">No thanks</button>
      </div>
      <script>
        document.getElementById("custom-close").onclick = () => {
          window.__customClosed = true;
          document.getElementById("zzz").style.display = "none";
        };
      </script>
    </body></html>`;
    await customPage.goto(
      `data:text/html;charset=utf-8,${encodeURIComponent(customHtml)}`,
      { waitUntil: "domcontentloaded" },
    );
    const custom = await dismissObstructions(customPage, log, "custom");
    if (!custom.dismissed) fail("custom floating overlay was not dismissed");
    const customClosed = await customPage.evaluate(() =>
      Boolean((window as { __customClosed?: boolean }).__customClosed),
    );
    if (!customClosed) fail("custom floating overlay button was not clicked");
    await customPage.close();
    console.log("FLOATING OVERLAY SMOKE OK");

    // The in-page live script must handle the same benign overlays while
    // leaving any human check alone.
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      const challenge = document.getElementById("challenge");
      if (challenge) challenge.style.display = "none";
    });
    await page.evaluate(autoDismissInitScript());
    await page.waitForTimeout(2600);

    if (!(await page.locator("#consent").isHidden())) fail("live: cookie consent was not dismissed");
    if (!(await page.locator("#newsletter").isHidden())) fail("live: newsletter was not dismissed");
    if (!(await page.locator("#region").isHidden())) fail("live: region prompt was not dismissed");
    const liveChallengeClicked = await page.evaluate(() =>
      Boolean((window as { __challengeClicked?: boolean }).__challengeClicked),
    );
    if (liveChallengeClicked) fail("live: human check was clicked");

    console.log("LIVE DISMISS SMOKE OK");
  } finally {
    await session.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});