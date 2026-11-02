import "dotenv/config";
import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { parseDefinition, validateFieldReferences } from "../shared/definition";
import { toJson } from "../shared/json";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@local.test";
const DEMO_PASSWORD = "password123";

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    console.log(`Seed skipped: demo user ${DEMO_EMAIL} already exists.`);
    return;
  }

  const definition = parseDefinition(
    readFileSync(new URL("../shared/examples/example-extract.json", import.meta.url), "utf8"),
  );
  const referenceIssues = validateFieldReferences(definition);
  if (referenceIssues.length > 0) {
    throw new Error(referenceIssues.map((issue) => issue.message).join("\n"));
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: DEMO_EMAIL, passwordHash, name: "Demo User" },
    });

    const team = await tx.team.create({ data: { name: "Demo team" } });

    await tx.membership.create({
      data: { userId: user.id, teamId: team.id, role: "OWNER" },
    });

    const automation = await tx.automation.create({
      data: {
        teamId: team.id,
        name: "Example: extract H1",
        description: "Seeded example.com flow",
        status: "ACTIVE",
      },
    });

    const version = await tx.automationVersion.create({
      data: {
        automationId: automation.id,
        versionNumber: 1,
        definition: toJson(definition),
      },
    });

    await tx.automation.update({
      where: { id: automation.id },
      data: { currentVersionId: version.id },
    });

    return { team, automation, version };
  });

  console.log("Seed complete.");
  console.log(`  email: ${DEMO_EMAIL}`);
  console.log(`  password: ${DEMO_PASSWORD}`);
  console.log(`  teamId: ${result.team.id}`);
  console.log(`  automationId: ${result.automation.id}`);
  console.log(`  versionId: ${result.version.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
