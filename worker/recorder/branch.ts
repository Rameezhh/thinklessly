import { z } from "zod";
import { conditionSchema } from "@shared/definition";

export const branchCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("beginIf"), condition: conditionSchema }),
  z.object({ kind: z.literal("setBranch"), branch: z.enum(["then", "else"]) }),
  z.object({ kind: z.literal("endIf") }),
]);

export type BranchCommand = z.infer<typeof branchCommandSchema>;
