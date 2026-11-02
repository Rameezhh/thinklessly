import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiKey } from "@/lib/api-auth";
import { findApiRun, serializeRun, waitForRun } from "@/lib/api-run";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(request);
  if (!auth) {
    return json({ error: "Missing or invalid API key." }, 401);
  }

  const { id } = await params;
  const runId = z.string().min(1).safeParse(id);
  if (!runId.success) return json({ error: "Invalid run id." }, 400);

  const rawWait = new URL(request.url).searchParams.get("wait");
  const parsedWait = z.coerce.number().int().min(0).max(30).safeParse(rawWait ?? 0);
  if (!parsedWait.success) return json({ error: "wait must be an integer between 0 and 30." }, 400);

  const run =
    parsedWait.data > 0
      ? await waitForRun(auth.teamId, runId.data, parsedWait.data)
      : await findApiRun(auth.teamId, runId.data);

  if (!run) return json({ error: "Run not found." }, 404);
  return json({ run: serializeRun(run) });
}
