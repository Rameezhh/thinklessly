import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { parseDefinition, validateFieldReferences } from "@shared/definition";
import { runAutomation } from "./runner";

const inputsSchema = z.record(z.string(), z.unknown());

function usage(): never {
  console.error(
    "Usage: pnpm run-file <definition.json> [--inputs <inputs.json>] [--run-dir <dir>] [--headless]",
  );
  process.exit(2);
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      inputs: { type: "string" },
      "run-dir": { type: "string" },
      headless: { type: "boolean", default: false },
    },
  });

  const definitionPath = positionals[0];
  if (!definitionPath) usage();

  const definition = parseDefinition(await readFile(resolve(definitionPath), "utf8"));
  const referenceIssues = validateFieldReferences(definition);
  if (referenceIssues.length > 0) {
    console.error(referenceIssues.map((issue) => issue.message).join("\n"));
    process.exit(1);
  }

  let inputs: Record<string, unknown> = {};
  if (values.inputs) {
    const raw = await readFile(resolve(values.inputs), "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      console.error(`Invalid inputs JSON: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
    const result = inputsSchema.safeParse(parsed);
    if (!result.success) {
      console.error("Inputs must be a JSON object of key/value pairs.");
      process.exit(1);
    }
    inputs = result.data;
  }

  const secrets: Record<string, string> = {};
  for (const field of definition.fields) {
    if (!field.secret) continue;
    if (Object.prototype.hasOwnProperty.call(inputs, field.key)) {
      secrets[field.key] = String(inputs[field.key] ?? "");
      delete inputs[field.key];
    }
  }

  const runDir = resolve(values["run-dir"] ?? resolve("data/artifacts", `cli-${Date.now()}`));

  const result = await runAutomation({
    definition,
    inputs,
    secrets,
    runDir,
    headless: values.headless,
    onLog: (entry) => {
      console.log(`[${entry.level}]${entry.stepId ? ` [${entry.stepId}]` : ""} ${entry.message}`);
    },
  });

  console.log("");
  console.log(
    JSON.stringify(
      {
        status: result.status,
        outputs: result.outputs,
        meta: result.meta,
        error: result.error,
        failedStepId: result.failedStepId,
        artifacts: result.artifacts.map((artifact) => ({
          kind: artifact.kind,
          name: artifact.name,
          path: artifact.path,
        })),
      },
      null,
      2,
    ),
  );

  if (result.status === "SUCCESS") return;
  process.exitCode = result.status === "NEEDS_HUMAN" ? 2 : 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
