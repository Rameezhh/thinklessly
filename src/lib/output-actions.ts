"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@shared/db";
import {
  DefinitionError,
  extractFieldSchema,
  outputKeySchema,
  parseDefinition,
} from "@shared/definition";
import { toJson } from "@shared/json";
import { findAutomation } from "./ownership";
import { requireUser } from "./session";

const editSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    type: z.literal("extract"),
    outputKey: outputKeySchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("extractStructured"),
    root: extractFieldSchema,
  }),
]);

const payloadSchema = z.object({
  automationId: z.string().min(1),
  edits: z.array(editSchema).min(1).max(50),
});

export type OutputPanelState = { error?: string; success?: string };

function issuesText(error: unknown): string {
  if (error instanceof DefinitionError) return error.issues.join("\n");
  return "The automation definition is invalid.";
}

export async function renameOutputsAction(
  _previousState: OutputPanelState,
  formData: FormData,
): Promise<OutputPanelState> {
  const user = await requireUser();
  const raw = formData.get("payload");
  if (typeof raw !== "string" || raw.length > 500_000) {
    return { error: "Invalid output changes." };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return { error: "Invalid output changes." };
  }

  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid output changes." };
  }

  const automation = await findAutomation(user.teamId, parsed.data.automationId);
  if (!automation?.currentVersion) return { error: "Automation not found." };

  let current;
  try {
    current = parseDefinition(automation.currentVersion.definition);
  } catch (error) {
    return { error: issuesText(error) };
  }

  const edits = new Map(parsed.data.edits.map((edit) => [edit.id, edit]));
  const unknown = parsed.data.edits.find((edit) => !current.steps.some((step) => step.id === edit.id));
  if (unknown) return { error: `Step "${unknown.id}" was not found in the current version.` };

  const steps = current.steps.map((step) => {
    const edit = edits.get(step.id);
    if (!edit) return step;
    if (step.type === "extract" && edit.type === "extract") {
      return { ...step, outputKey: edit.outputKey };
    }
    if (step.type === "extractStructured" && edit.type === "extractStructured") {
      return { ...step, root: edit.root };
    }
    return step;
  });

  const mismatched = current.steps.find((step) => {
    const edit = edits.get(step.id);
    return edit && edit.type !== step.type;
  });
  if (mismatched) return { error: `Step "${mismatched.id}" cannot be changed this way.` };

  let updated;
  try {
    updated = parseDefinition({ ...current, steps });
  } catch (error) {
    return { error: issuesText(error) };
  }

  if (JSON.stringify(updated) === JSON.stringify(current)) {
    return { success: "No changes to save." };
  }

  let versionNumber: number;
  try {
    versionNumber = await prisma.$transaction(async (tx) => {
      const latest = await tx.automationVersion.aggregate({
        where: { automationId: automation.id },
        _max: { versionNumber: true },
      });
      const next = (latest._max.versionNumber ?? 0) + 1;
      const version = await tx.automationVersion.create({
        data: {
          automationId: automation.id,
          versionNumber: next,
          definition: toJson(updated),
        },
      });
      await tx.automation.update({
        where: { id: automation.id },
        data: { currentVersionId: version.id },
      });
      return next;
    });
  } catch {
    return { error: "Could not save the output keys. Please try again." };
  }

  revalidatePath(`/dashboard/automations/${automation.id}`);
  revalidatePath("/dashboard/automations");
  revalidatePath("/dashboard/runs/[id]", "page");
  return { success: `Saved output keys as version ${versionNumber}.` };
}
