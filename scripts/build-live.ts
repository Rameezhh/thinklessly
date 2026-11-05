import { createRequire } from "node:module";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vendor = resolve(root, "public", "live", "vendor");

const { scramjetPath } = require("@mercuryworkshop/scramjet/path") as { scramjetPath: string };
const { baremuxPath } = require("@mercuryworkshop/bare-mux/node") as { baremuxPath: string };
const { libcurlPath } = require("@mercuryworkshop/libcurl-transport") as { libcurlPath: string };

async function copy(name: string, from: string): Promise<void> {
  const to = resolve(vendor, name);
  await rm(to, { recursive: true, force: true });
  await mkdir(dirname(to), { recursive: true });
  await cp(from, to, { recursive: true });
}

// The libcurl transport constructs its session before its async WASM module is
// guaranteed to be ready, which throws "wasm not loaded yet" on the first
// request. Await load_wasm() first. Kept as a build step so it tracks upgrades.
async function patchLibcurl(): Promise<void> {
  const file = resolve(vendor, "libcurl", "index.mjs");
  const source = await readFile(file, "utf8");
  const marker = "    libcurl.set_websocket(this.wisp);";
  if (!source.includes(marker)) {
    throw new Error("[live] could not find libcurl init marker; update scripts/build-live.ts");
  }
  if (source.includes("await libcurl.load_wasm();")) return;
  const patched = source.replace(marker, `    await libcurl.load_wasm();\n${marker}`);
  await writeFile(file, patched);
}

async function main(): Promise<void> {
  await mkdir(vendor, { recursive: true });
  await copy("scram", scramjetPath);
  await copy("baremux", baremuxPath);
  await copy("libcurl", libcurlPath);
  await patchLibcurl();
  console.log(`[live] vendor assets copied to ${vendor}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
