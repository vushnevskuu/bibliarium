import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Fewer SQLITE_BUSY under parallel dev (WAL + wait). PRAGMAs return rows → queryRaw. */
if (process.env.DATABASE_URL?.startsWith("file:")) {
  void prisma
    .$connect()
    .then(() => prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL"))
    .then(() => prisma.$queryRawUnsafe("PRAGMA busy_timeout = 8000"))
    .catch((e) => console.warn("[prisma] SQLite pragma:", e));
}
