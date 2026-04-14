import { z } from "zod";

export const createLinkBodySchema = z.object({
  url: z.string().min(1, "Paste a URL"),
  collectionId: z.string().min(1).optional().nullable(),
});

export const patchLinkBodySchema = z.object({
  collectionId: z.string().min(1).nullable().optional(),
  note: z
    .string()
    .max(2000, "Note must be at most 2000 characters")
    .optional()
    .nullable(),
  isPublic: z.boolean().optional(),
});

export const patchUserBodySchema = z.object({
  aiProfilePublic: z.boolean().optional(),
});

export const createCollectionBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
});
