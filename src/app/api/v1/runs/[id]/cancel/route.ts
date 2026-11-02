import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@shared/db";
import { sendRunWebhook } from "@shared/webhook";
import { authenticateApiKey } from "@/lib/api-auth";
import { findApiRun, serializeRun } from "@/lib/api-run";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

const terminalStatuses = new Set(["SUCCESS", "FAILED", "CANCELLED", "NEEDS_HUMAN"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(request);
  if (!auth) {
    return json({ error: "Missing or invalid API key." }, 401);
  }

  const { id } = await params;
  const runId = z.string().min(1).safeParse(id);
  if (!runId.success) return json({ error: "Invalid run id." }, 400);

  const run = await findApiRun(auth.teamId, runId.data);
  if (!run) return json({ error: "Run not found." }, 404);
  if (terminalStatuses.has(run.status)) {
    return json({ error: "Run is already finished.", run: serializeRun(run) }, 409);
  }

  const cancelledQueued = await prisma.run.updateMany({
    where: { id: run.id, teamId: auth.teamId, status: "QUEUED" },
    data: {
      status: "CANCELLED",
      error: "Run cancelled",
      ephemeralSecrets: null,
      finishedAt: new Date(),
    },
  });

  if (cancelledQueued.count > 0) {
    void sendRunWebhook(run.id);
  } else {
    const cancelledRunning = await prisma.run.updateMany({
      where: { id: run.id, teamId: auth.teamId, status: "RUNNING" },
      data: {
        status: "CANCELLED",
        error: "Run cancelled",
        ephemeralSecrets: null,
        finishedAt: new Date(),
      },
    });
    if (cancelledRunning.count === 0) {
      const current = await findApiRun(auth.teamId, run.id);
      return json(
        { error: "Run is already finished.", run: current ? serializeRun(current) : null },
        409,
      );
    }
  }

  const cancelled = await findApiRun(auth.teamId, run.id);
  if (!cancelled) return json({ error: "Run not found." }, 404);
  return json({ run: serializeRun(cancelled) });
}
