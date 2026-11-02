-- AlterTable
ALTER TABLE "Trigger" ADD COLUMN "delaySeconds" INTEGER;
ALTER TABLE "Trigger" ADD COLUMN "lastFiredAt" DATETIME;
ALTER TABLE "Trigger" ADD COLUMN "nextRunAt" DATETIME;

