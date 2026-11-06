import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const proxyPort = process.env.SIM_PROXY_PORT ?? "8443";
const publicWispUrl =
  process.env.NEXT_PUBLIC_WISP_URL ?? `wss://localhost:${proxyPort}/live/wisp/`;

console.log(`[sim] production build with NEXT_PUBLIC_WISP_URL=${publicWispUrl}`);

const result = spawnSync("pnpm", ["exec", "next", "build"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_WISP_URL: publicWispUrl },
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);