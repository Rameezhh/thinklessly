import "dotenv/config";
import { z } from "zod";
import { prisma } from "../shared/db";
import { enqueueRun } from "../shared/queue";

const automationIdSchema = z.string().min(1, "Usage: pnpm enqueue-test <automationId>");

async function main() {
  const automationId = automationIdSchema.parse(process.argv[2]);
  const run = await enqueueRun({ automationId, inputs: {}, triggerSource: "MANUAL" });
  console.log(`Enqueued run ${run.id} for automation ${automationId} (status ${run.status}).`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
