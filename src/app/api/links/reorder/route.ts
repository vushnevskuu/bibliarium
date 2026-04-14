import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedAppUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)),
});

export async function PUT(request: Request) {
  const ctx = await getAuthenticatedAppUser();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { ids } = parsed.data;
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    return NextResponse.json({ error: "Duplicate ids" }, { status: 400 });
  }

  const existing = await prisma.link.findMany({
    where: { userId: ctx.appUser.id },
    select: { id: true },
  });
  const existingSet = new Set(existing.map((e) => e.id));

  if (ids.length !== existingSet.size) {
    return NextResponse.json(
      { error: "Must include every link id exactly once" },
      { status: 400 }
    );
  }

  for (const id of ids) {
    if (!existingSet.has(id)) {
      return NextResponse.json({ error: "Unknown link id" }, { status: 400 });
    }
  }

  const n = ids.length;

  await prisma.$transaction(
    ids.map((id, i) =>
      prisma.link.update({
        where: { id },
        data: { sortOrder: n - i },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
