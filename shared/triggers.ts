import { Cron } from "croner";
import { z } from "zod";

export const cronExpressionSchema = z
  .string()
  .trim()
  .min(1, "Cron expression is required")
  .max(120, "Cron expression is too long");

export const timezoneSchema = z
  .string()
  .trim()
  .min(1, "Timezone is required")
  .max(64, "Timezone is too long");

export function computeNextCronRun(
  expression: string,
  timezone: string,
  from: Date = new Date(),
): Date | null {
  const job = new Cron(expression, { timezone, paused: true });
  try {
    return job.nextRun(from);
  } finally {
    job.stop();
  }
}

export function isValidCron(expression: string, timezone: string): boolean {
  try {
    return computeNextCronRun(expression, timezone) !== null;
  } catch {
    return false;
  }
}
