import "dotenv/config";
import { resolve } from "node:path";
import { z } from "zod";
import { parseDefinition, validateFieldReferences } from "@shared/definition";
import { configureSqlite, prisma } from "@shared/db";
import { fromJson, toJson } from "@shared/json";
import { ephemeralSecretSchema } from "@shared/queue";
import { redactSecrets } from "@shared/redact";
import { decryptSecret } from "@shared/secrets";
import { sendRunWebhook } from "@shared/webhook";
import { startRecorderServer, type RecorderServerHandle } from "./recorder/server";
import { runAutomation } from "./runner";
import { startScheduler } from "./scheduler";

const envSchema = z.object({
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
  WORKER_POLL_MS: z.coerce.number().int().positive().default(1000),
  WORKER_HEADLESS: z.enum(["true", "false"]).default("false"),
  RECORDER_PORT: z.coerce.number().int().positive().default(4001),
  RECORDER_MAX_SESSIONS: z.coerce.number().int().positive().default(1),
});

type WorkerConfig = {
  concurrency: number;
  pollMs: number;
  headless: boolean;
  recorderPort: number;
  recorderMaxSessions: number;
};

let config: WorkerConfig = {
  concurrency: 2,
  pollMs: 1000,
  headless: false,
  recorderPort: 4001,
  recorderMaxSessions: 1,
};
let shuttingDown = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let stopScheduler: (() => void) | undefined;
let recorder: RecorderServerHandle | undefined;
const inFlight = new Set<Promise<void>>();
const activeAutomations = new Set<string>();

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function claimNextRun() {
  const candidate = await prisma.run.findFirst({
    where: {
      status: "QUEUED",
      scheduledAt: { lte: new Date() },
      ...(activeAutomations.size > 0
        ? { automationId: { notIn: [...activeAutomations] } }
        : {}),
    },
    orderBy: { scheduledAt: "asc" },
    select: { id: true, automationId: true },
  });
  if (!candidate) return null;

  const claimed = await prisma.run.updateMany({
    where: { id: candidate.id, status: "QUEUED" },
    data: { status: "RUNNING", startedAt: new Date() },
  });
  if (claimed.count === 0) return null;

  activeAutomations.add(candidate.automationId);
  try {
    const run = await prisma.run.findUnique({
      where: { id: candidate.id },
      include: { version: true },
    });
    if (!run) activeAutomations.delete(candidate.automationId);
    return run;
  } catch (error) {
    activeAutomations.delete(candidate.automationId);
    throw error;
  }
}

type ClaimedRun = NonNullable<Awaited<ReturnType<typeof claimNextRun>>>;

async function processRun(run: ClaimedRun): Promise<void> {
  const secrets: Record<string, string> = {};

  try {
    const definition = parseDefinition(run.version.definition);
    const referenceIssues = validateFieldReferences(definition);
    if (referenceIssues.length > 0) {
      throw new Error(referenceIssues.map((issue) => issue.message).join("; "));
    }

    const secretRows = await prisma.secret.findMany({ where: { automationId: run.automationId } });
    for (const row of secretRows) {
      secrets[row.fieldKey] = decryptSecret(row);
    }

    const ephemeralSecrets = run.ephemeralSecrets
      ? z.array(ephemeralSecretSchema).parse(fromJson<unknown>(run.ephemeralSecrets, []))
      : [];
    for (const entry of ephemeralSecrets) {
      secrets[entry.fieldKey] = decryptSecret(entry);
    }

    const inputs = fromJson<Record<string, unknown>>(run.inputs, {});
    const runDir = resolve("data/artifacts", run.id);

    const log = async (level: string, message: string, stepId?: string) => {
      const safeMessage = redactSecrets(message, secrets);
      try {
        await prisma.runLog.create({
          data: { runId: run.id, level, message: safeMessage, stepId },
        });
      } catch (error) {
        console.error(`[worker] could not write log for run ${run.id}: ${errorMessage(error)}`);
      }
      console.log(`[run ${run.id}] [${level}]${stepId ? ` [${stepId}]` : ""} ${safeMessage}`);
    };

    const result = await runAutomation({
      definition,
      inputs,
      secrets,
      runDir,
      headless: config.headless,
      profileKey: run.automationId,
      shouldCancel: async () => {
        const current = await prisma.run.findUnique({ where: { id: run.id }, select: { status: true } });
        return current?.status === "CANCELLED";
      },
      onLog: (entry) => log(entry.level, entry.message, entry.stepId),
    });

    if (result.artifacts.length > 0) {
      await prisma.runArtifact.createMany({
        data: result.artifacts.map((artifact) => ({
          runId: run.id,
          kind: artifact.kind,
          path: artifact.path,
        })),
      });
    }

    const finished = await prisma.run.updateMany({
      where: { id: run.id, status: { not: "CANCELLED" } },
      data: {
        status: result.status,
        outputs: toJson(result.outputs),
        error: result.error ?? null,
        ephemeralSecrets: null,
        finishedAt: new Date(),
      },
    });
    if (finished.count === 0) {
      await prisma.run
        .update({ where: { id: run.id }, data: { ephemeralSecrets: null } })
        .catch(() => undefined);
    }

    console.log(`[worker] run ${run.id} finished with ${result.status}`);
    void sendRunWebhook(run.id);
  } catch (error) {
    const message = redactSecrets(errorMessage(error), secrets);
    await prisma.runLog
      .create({ data: { runId: run.id, level: "error", message } })
      .catch(() => undefined);
    await prisma.run
      .updateMany({
        where: { id: run.id, status: { not: "CANCELLED" } },
        data: { status: "FAILED", error: message, ephemeralSecrets: null, finishedAt: new Date() },
      })
      .catch(() => undefined);
    console.error(`[worker] run ${run.id} failed: ${message}`);
    void sendRunWebhook(run.id);
  }
}

async function poll(): Promise<void> {
  if (shuttingDown) return;

  try {
    while (!shuttingDown && inFlight.size < config.concurrency) {
      const run = await claimNextRun();
      if (!run) break;

      console.log(`[worker] claimed run ${run.id}`);
      const task = processRun(run)
        .catch((error) => {
          console.error(`[worker] run ${run.id} crashed: ${errorMessage(error)}`);
        })
        .finally(() => {
          activeAutomations.delete(run.automationId);
          inFlight.delete(task);
        });
      inFlight.add(task);
    }
  } catch (error) {
    console.error(`[worker] poll failed: ${errorMessage(error)}`);
  } finally {
    if (!shuttingDown) {
      timer = setTimeout(() => void poll(), config.pollMs);
    }
  }
}

async function recoverStaleRuns(): Promise<void> {
  const stale = await prisma.run.updateMany({
    where: { status: "RUNNING" },
    data: { status: "FAILED", error: "worker restarted", ephemeralSecrets: null, finishedAt: new Date() },
  });
  if (stale.count > 0) {
    console.log(`[worker] marked ${stale.count} stale RUNNING run(s) as FAILED`);
  }
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  if (timer) clearTimeout(timer);
  stopScheduler?.();
  await recorder?.stop().catch((error) => {
    console.error(`[worker] recorder shutdown failed: ${errorMessage(error)}`);
  });

  console.log(`[worker] ${signal} received; waiting for ${inFlight.size} run(s) to stop`);
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 20000));
  await Promise.race([Promise.allSettled([...inFlight]).then(() => undefined), timeout]);
  await prisma.$disconnect();
  console.log("[worker] stopped");
  process.exit(0);
}

async function main(): Promise<void> {
  const env = envSchema.parse(process.env);
  config = {
    concurrency: env.WORKER_CONCURRENCY,
    pollMs: env.WORKER_POLL_MS,
    headless: env.WORKER_HEADLESS === "true",
    recorderPort: env.RECORDER_PORT,
    recorderMaxSessions: env.RECORDER_MAX_SESSIONS,
  };

  await configureSqlite();
  await recoverStaleRuns();

  stopScheduler = await startScheduler();

  try {
    recorder = await startRecorderServer({
      port: config.recorderPort,
      maxSessions: config.recorderMaxSessions,
    });
    console.log(`[recorder] listening on http://127.0.0.1:${config.recorderPort}`);
  } catch (error) {
    console.error(`[recorder] unavailable: ${errorMessage(error)}`);
  }

  console.log(
    `[worker] started: concurrency=${config.concurrency}, poll=${config.pollMs}ms, headless=${config.headless}`,
  );

  void poll();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

main().catch(async (error) => {
  console.error(`[worker] failed to start: ${errorMessage(error)}`);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
