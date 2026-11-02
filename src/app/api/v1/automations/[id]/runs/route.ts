import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@shared/db";
import { enqueueRun } from "@shared/queue";
import { authenticateApiKey } from "@/lib/api-auth";
import {
  apiRunBodySchema,
  findApiRun,
  prepareApiRun,
  serializeRun,
  waitForRun,
} from "@/lib/api-run";

function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function waitSecondsFrom(request: Request): number | null {
  const raw = new URL(request.url).searchParams.get("wait");
  const parsed = z.coerce.number().int().min(0).max(30).safeParse(raw ?? 0);
  return parsed.success ? parsed.data : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(request);
  if (!auth) {
    return json({ error: "Missing or invalid API key." }, 401, { "WWW-Authenticate": "Bearer" });
  }

  const { id } = await params;
  const automationId = z.string().min(1).safeParse(id);
  if (!automationId.success) return json({ error: "Invalid automation id." }, 400);

  const waitSeconds = waitSecondsFrom(request);
  if (waitSeconds === null) return json({ error: "wait must be an integer between 0 and 30." }, 400);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const body = apiRunBodySchema.safeParse(payload);
  if (!body.success) {
    return json({ error: body.error.issues[0]?.message ?? "Invalid request body." }, 400);
  }

  const prepared = await prepareApiRun(auth.teamId, automationId.data, body.data);
  if (!prepared.ok) return json({ error: prepared.message }, prepared.status);

  const rawIdempotencyKey = request.headers.get("idempotency-key");
  let idempotencyKey: string | undefined;
  if (rawIdempotencyKey !== null) {
    const parsedKey = z.string().trim().min(1).max(200).safeParse(rawIdempotencyKey);
    if (!parsedKey.success) return json({ error: "Invalid Idempotency-Key header." }, 400);
    idempotencyKey = parsedKey.data;

    const existing = await prisma.run.findFirst({
      where: { teamId: auth.teamId, idempotencyKey },
      select: { id: true, automationId: true },
    });
    if (existing) {
      if (existing.automationId !== automationId.data) {
        return json({ error: "This Idempotency-Key was used for another automation." }, 409);
      }
      const run =
        waitSeconds > 0
          ? await waitForRun(auth.teamId, existing.id, waitSeconds)
          : await findApiRun(auth.teamId, existing.id);
      if (!run) return json({ error: "Run not found." }, 404);
      return json({ run: serializeRun(run) }, 200, { "Idempotency-Replayed": "true" });
    }
  }

  let runId: string;
  try {
    const run = await enqueueRun({
      automationId: automationId.data,
      inputs: prepared.inputs,
      triggerSource: "API",
      ephemeralSecrets: prepared.ephemeralSecrets,
      idempotencyKey,
    });
    runId = run.id;
  } catch (error) {
    if (idempotencyKey && (error as { code?: string }).code === "P2002") {
      const existing = await prisma.run.findFirst({
        where: { teamId: auth.teamId, idempotencyKey },
        select: { id: true, automationId: true },
      });
      if (existing && existing.automationId === automationId.data) {
        const run =
          waitSeconds > 0
            ? await waitForRun(auth.teamId, existing.id, waitSeconds)
            : await findApiRun(auth.teamId, existing.id);
        if (!run) return json({ error: "Run not found." }, 404);
        return json({ run: serializeRun(run) }, 200, { "Idempotency-Replayed": "true" });
      }
    }
    return json({ error: "Could not queue the run." }, 500);
  }

  const run =
    waitSeconds > 0 ? await waitForRun(auth.teamId, runId, waitSeconds) : await findApiRun(auth.teamId, runId);
  if (!run) return json({ error: "Run not found." }, 404);

  const finished = ["SUCCESS", "FAILED", "CANCELLED", "NEEDS_HUMAN"].includes(run.status);
  return json({ run: serializeRun(run) }, finished ? 200 : 202);
}
