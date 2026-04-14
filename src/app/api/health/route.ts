import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Быстрая проверка: процесс жив и SQLite отвечает. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[GET /api/health]", e);
    const message = e instanceof Error ? e.message : "unavailable";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
