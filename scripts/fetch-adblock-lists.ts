import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SOURCES = [
  "https://easylist.to/easylist/easylist.txt",
  "https://easylist.to/easylist/easyprivacy.txt",
];

const target = resolve(process.argv[2] ?? "data/adblock/list.txt");

async function main(): Promise<void> {
  const chunks: string[] = [];
  for (const url of SOURCES) {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    const text = await response.text();
    chunks.push(`! Source: ${url}\n${text}`);
    console.log(`Fetched ${url} (${text.length} chars)`);
  }

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, chunks.join("\n\n"), "utf8");
  console.log(`Wrote ${target}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
