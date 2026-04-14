import { prisma } from "@/lib/prisma";

/** Per-user serialization so parallel RSC/dev requests do not SQLITE_BUSY the same transaction. */
const ensureInFlight = new Map<string, Promise<void>>();

/**
 * Legacy rows all had sortOrder 0 — assign monotonic scores from createdAt once (per user).
 */
export function ensureDistinctLinkSortOrdersForUser(
  userId: string
): Promise<void> {
  const existing = ensureInFlight.get(userId);
  if (existing) return existing;

  const job = (async () => {
    try {
      const rows = await prisma.link.findMany({
        where: { userId },
        select: { id: true, sortOrder: true, createdAt: true },
      });
      if (rows.length <= 1) return;

      const values = new Set(rows.map((r) => r.sortOrder));
      if (values.size > 1) return;

      const ordered = [...rows].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );

      const n = ordered.length;
      await prisma.$transaction(
        ordered.map((l, i) =>
          prisma.link.update({
            where: { id: l.id },
            data: { sortOrder: n - i },
          })
        )
      );
    } finally {
      ensureInFlight.delete(userId);
    }
  })();

  ensureInFlight.set(userId, job);
  return job;
}
