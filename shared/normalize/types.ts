import { z } from "zod";

export const normalizedTypeSchema = z.enum([
  "string",
  "number",
  "currency",
  "boolean",
  "date",
  "url",
  "array",
  "object",
]);
export type NormalizedType = z.infer<typeof normalizedTypeSchema>;

export const normalizeFieldSchema = z.object({
  key: z.string().min(1).max(80),
  type: normalizedTypeSchema,
  aliases: z.array(z.string().max(120)).max(60).default([]),
});
export type NormalizeField = z.infer<typeof normalizeFieldSchema>;

export const normalizePlanSchema = z.object({
  version: z.literal(1),
  entity: z.string().max(40).optional(),
  fields: z.array(normalizeFieldSchema).max(300),
  flatten: z.boolean().default(true),
  dropEmpty: z.boolean().default(true),
  coerce: z.boolean().default(true),
});
export type NormalizePlan = z.infer<typeof normalizePlanSchema>;

export const outputMetaSchema = z.object({
  source: z.enum(["api", "html"]),
  endpoint: z.string().max(4000).optional(),
  method: z.string().max(10).optional(),
  entity: z.string().max(40).optional(),
  count: z.number().int().nonnegative().optional(),
  columns: z.array(z.string().max(80)).max(300).default([]),
  normalized: z.boolean().default(false),
  healed: z.number().int().nonnegative().optional(),
  dismissed: z.number().int().nonnegative().optional(),
  skipped: z.array(z.string().max(120)).max(100).optional(),
});
export type OutputMeta = z.infer<typeof outputMetaSchema>;
