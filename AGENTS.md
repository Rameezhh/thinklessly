<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

PROJECT: Local-first browser automation SaaS. Users record a browser flow, review it, then run it manually, by API, cron, or timer. Everything must run on one developer machine with NO Docker, NO external services, NO paid services.

STACK (single project, TypeScript):
- Next.js (App Router, Tailwind) in /src for UI and API routes
- /worker: Node process using Playwright (run with tsx). Playwright NEVER runs inside Next.js.
- /shared: Zod schemas and shared types/helpers (imported by both src and worker via tsconfig paths)
- /prisma: Prisma with SQLite (file: ../data/app.db, resolved from prisma/)
- Queue: database-backed. A run with status QUEUED is picked up by the worker polling every 1 second and claimed with an atomic update so two workers never take the same run.
- Scheduling: croner package inside the worker
- Files (screenshots, uploads): ./data/artifacts/... and ./data/uploads/...
- One command `pnpm dev` starts web + worker together (concurrently).

SQLITE NOTES: store enums as String fields validated by Zod, and JSON as String with small helper functions (toJson/fromJson), so it works on any Prisma version.

RULES:
1. Do only what I ask in this prompt. No extra features.
2. Small files, clear names, under 300 lines each.
3. Validate all external input with Zod.
4. Never log secrets. Never return secrets from any API.
5. Every feature must come with a way for me to test it manually (script, curl, or page).
6. When done, list: files created/changed, how to run it, how to test it, what is unfinished.
7. Ask at most ONE question, only if truly blocked. Otherwise choose a sensible default and say what you chose.
8. Free, open-source packages only.
