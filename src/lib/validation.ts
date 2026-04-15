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

export const extensionCaptureBodySchema = z.object({
  url: z.string().min(1, "URL required"),
  title: z.string().max(500).optional().nullable(),
  faviconUrl: z
    .string()
    .optional()
    .nullable()
    .transform((s) => {
      if (s === null || s === undefined) return null;
      const t = typeof s === "string" ? s.trim() : "";
      if (!t) return null;
      if (!/^https?:\/\//i.test(t)) return null;
      try {
        const u = new URL(t);
        return u.href;
      } catch {
        return null;
      }
    }),
  pageType: z.string().max(80).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
  selectedText: z.string().max(5000).optional().nullable(),
  source: z
    .enum([
      "toolbar",
      "context-link",
      "context-page",
      "context-image",
      "popup",
      "keyboard",
    ])
    .optional(),
  collectionId: z.string().min(1).optional().nullable(),
  tags: z.array(z.string().max(40)).max(20).optional(),
});

export const extensionRefreshBodySchema = z.object({
  refresh_token: z.string().min(1),
});

export const createCollectionBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
});
