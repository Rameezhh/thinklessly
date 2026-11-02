import { prisma } from "@shared/db";

export async function findAutomation(teamId: string, automationId: string) {
  return prisma.automation.findFirst({
    where: { id: automationId, teamId },
    include: { currentVersion: true },
  });
}

export async function findRun(teamId: string, runId: string) {
  return prisma.run.findFirst({
    where: { id: runId, teamId },
    include: {
      automation: true,
      logs: { orderBy: { createdAt: "asc" } },
      artifacts: { orderBy: { createdAt: "asc" } },
    },
  });
}
