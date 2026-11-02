-- AlterTable
ALTER TABLE "Run" ADD COLUMN "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN "webhookSecretCipher" TEXT;
ALTER TABLE "Team" ADD COLUMN "webhookUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Run_teamId_idempotencyKey_key" ON "Run"("teamId", "idempotencyKey");

