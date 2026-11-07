import { resolve } from "node:path";
import type { AutomationDefinition, Step } from "../shared/definition";
import { runAutomation } from "../worker/runner";

const html = `<!doctype html><html><body>
  <button id="buy-1" type="button" onclick="document.getElementById('status').textContent='clicked'">Add to cart</button>
  <p id="status">idle</p>
  <input id="email" type="email" placeholder="Email" />
  <div id="greeting">Hello</div>
</body></html>`;

const url = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

const steps: Step[] = [
  { id: "goto", type: "goto", enabled: true, url, criticality: "required", optional: false },
  {
    id: "heal",
    type: "click",
    enabled: true,
    criticality: "preferred",
    optional: false,
    selectors: [
      { kind: "css", value: "#buy-2" },
      { kind: "text", value: "Add to cart now" },
    ],
  },
  {
    id: "skip",
    type: "click",
    enabled: true,
    criticality: "preferred",
    optional: false,
    selectors: [
      { kind: "css", value: "#totally-missing" },
      { kind: "text", value: "Nonexistent button" },
    ],
  },
  {
    id: "fill",
    type: "fill",
    enabled: true,
    criticality: "required",
    optional: false,
    selectors: [{ kind: "css", value: "#email" }],
    value: { mode: "literal", text: "a@b.com" },
  },
  {
    id: "read-status",
    type: "extract",
    enabled: true,
    criticality: "required",
    optional: false,
    selectors: [{ kind: "css", value: "#status" }],
    attribute: "text",
    outputKey: "status",
  },
  {
    id: "read-greeting",
    type: "extract",
    enabled: true,
    criticality: "required",
    optional: false,
    selectors: [{ kind: "css", value: "#greeting" }],
    attribute: "text",
    outputKey: "greeting",
  },
];

const definition: AutomationDefinition = {
  version: 1,
  startUrl: url,
  fields: [],
  steps,
  settings: { stepTimeoutMs: 5000, runTimeoutMs: 30000, allowHumanHelp: true },
};

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const logs: string[] = [];
  const result = await runAutomation({
    definition,
    inputs: {},
    secrets: {},
    runDir: resolve("data", "artifacts", "smoke"),
    headless: true,
    profileKey: "smoke",
    onLog: (entry) => {
      logs.push(`${entry.level}: ${entry.message}`);
    },
  });

  if (result.status !== "SUCCESS") fail(`expected SUCCESS, got ${result.status}: ${result.error ?? ""}`);
  if (result.outputs.status !== "clicked") fail(`healed click did not run (status=${String(result.outputs.status)})`);
  if (result.outputs.greeting !== "Hello") fail(`extract output wrong: ${String(result.outputs.greeting)}`);
  if (result.meta.status?.source !== "html") fail("missing html meta for extracted output");
  if (!logs.some((line) => line.includes("Healed"))) fail("no heal log found");
  if (!logs.some((line) => line.includes("skipped"))) fail("no skipped-step log found");

  console.log("SMOKE OK");
  console.log(`outputs: ${JSON.stringify(result.outputs)}`);
  for (const line of logs.filter((entry) => entry.includes("Healed") || entry.includes("skipped"))) {
    console.log(`  ${line}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
