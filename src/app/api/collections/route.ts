import { NextResponse } from "next/server";
import { getAuthenticatedAppUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { createCollectionBodySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export async function GET() {
  const ctx = await getAuthenticatedAppUser();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const collections = await prisma.collection.findMany({
    where: { userId: ctx.appUser.id },
    orderBy: { name: "asc" },
    include: { _count: { select: { links: true } } },
  });
  return NextResponse.json({ collections });
}

export async function POST(request: Request) {
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

  const parsed = createCollectionBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const base = slugify(parsed.data.name) || "collection";
  let slug = base;
  let n = 0;
  for (;;) {
    const exists = await prisma.collection.findUnique({
      where: {
        userId_slug: { userId: ctx.appUser.id, slug },
      },
    });
    if (!exists) break;
    n += 1;
    slug = `${base}-${n}`;
  }

  const collection = await prisma.collection.create({
    data: {
      userId: ctx.appUser.id,
      name: parsed.data.name,
      slug,
    },
  });

  return NextResponse.json({ collection }, { status: 201 });
}
