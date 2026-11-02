import { prisma } from "@shared/db";
import { fromJson } from "@shared/json";
import { enqueueRun, runInputsSchema } from "@shared/queue";
import { computeNextCronRun } from "@shared/triggers";

const POLL_MS = 1000;

let stopped = false;
let running = false;
let timer: ReturnType<typeof setTimeout> | undefined;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function initializeTriggers(): Promise<void> {
  const missing = await prisma.trigger.findMany({
    where: { enabled: true, type: "CRON", nextRunAt: null },
    select: { id: true, cronExpression: true, timezone: true },
  });

  for (const trigger of missing) {
    try {
      const nextRunAt = computeNextCronRun(trigger.cronExpression ?? "", trigger.timezone ?? "UTC");
      await prisma.trigger.update({
        where: { id: trigger.id },
        data: nextRunAt ? { nextRunAt } : { enabled: false, nextRunAt: null },
      });
    } catch {
      await prisma.trigger
        .update({ where: { id: trigger.id }, data: { enabled: false, nextRunAt: null } })
        .catch(() => undefined);
      console.error(`[scheduler] trigger ${trigger.id}: invalid cron expression, disabled`);
    }
  }
}

async function fireDueTriggers(): Promise<void> {
  const now = new Date();
  const due = await prisma.trigger.findMany({
    where: {
      enabled: true,
      type: { in: ["CRON", "DELAY"] },
      nextRunAt: { lte: now },
    },
    orderBy: { nextRunAt: "asc" },
    take: 20,
    include: { automation: { select: { id: true, name: true, currentVersionId: true } } },
  });

  for (const trigger of due) {
    const firedAt = new Date();
    let claimed: { count: number };

    if (trigger.type === "CRON") {
      let nextRunAt: Date | null = null;
      try {
        nextRunAt = computeNextCronRun(trigger.cronExpression ?? "", trigger.timezone ?? "UTC", firedAt);
      } catch {
        nextRunAt = null;
      }

      claimed = await prisma.trigger.updateMany({
        where: { id: trigger.id, enabled: true, nextRunAt: trigger.nextRunAt },
        data: {
          nextRunAt,
          lastFiredAt: firedAt,
          enabled: nextRunAt !== null,
        },
      });
    } else {
      claimed = await prisma.trigger.updateMany({
        where: { id: trigger.id, enabled: true, nextRunAt: trigger.nextRunAt },
        data: { enabled: false, nextRunAt: null, lastFiredAt: firedAt },
      });
    }

    if (claimed.count === 0) continue;

    if (!trigger.automation.currentVersionId) {
      console.error(`[scheduler] trigger ${trigger.id}: automation has no published version`);
      continue;
    }

    const inputs = runInputsSchema.safeParse(fromJson<unknown>(trigger.inputs, {}));
    if (!inputs.success) {
      console.error(`[scheduler] trigger ${trigger.id}: inputs are not a JSON object`);
      continue;
    }

    try {
      const run = await enqueueRun({
        automationId: trigger.automationId,
        inputs: inputs.data,
        triggerSource: trigger.type === "CRON" ? "CRON" : "DELAY",
      });
      console.log(
        `[scheduler] ${trigger.type.toLowerCase()} trigger ${trigger.id} -> run ${run.id} (${trigger.automation.name})`,
      );
    } catch (error) {
      console.error(`[scheduler] trigger ${trigger.id}: could not queue run: ${errorMessage(error)}`);
    }
  }
}

async function tick(): Promise<void> {
  if (stopped || running) return;
  running = true;
  try {
    await fireDueTriggers();
  } catch (error) {
    console.error(`[scheduler] poll failed: ${errorMessage(error)}`);
  } finally {
    running = false;
    if (!stopped) timer = setTimeout(() => void tick(), POLL_MS);
  }
}

export async function startScheduler(): Promise<() => void> {
  stopped = false;
  try {
    await initializeTriggers();
  } catch (error) {
    console.error(`[scheduler] initialization failed: ${errorMessage(error)}`);
  }
  void tick();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
