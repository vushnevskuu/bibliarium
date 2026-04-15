import { NextResponse } from "next/server";
import { getAuthenticatedAppUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { serializeLink } from "@/lib/serialize";
import { patchLinkBodySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

async function canReadLink(
  linkId: string,
  appUserId: string | null
): Promise<{ link: Awaited<ReturnType<typeof prisma.link.findUnique>> } | null> {
  const link = await prisma.link.findUnique({ where: { id: linkId } });
  if (!link) return null;
  if (link.isPublic) return { link };
  if (appUserId && link.userId === appUserId) return { link };
  return null;
}

export async function GET(_request: Request, context: Ctx) {
  const { id } = context.params;
  try {
    const ctx = await getAuthenticatedAppUser();
    const allowed = await canReadLink(id, ctx?.appUser.id ?? null);
    if (!allowed?.link) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    return NextResponse.json({ link: serializeLink(allowed.link) });
  } catch {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }
}

export async function PATCH(request: Request, context: Ctx) {
  const ctx = await getAuthenticatedAppUser();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchLinkBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { collectionId, note, title, isPublic } = parsed.data;

  const existing = await prisma.link.findFirst({
    where: { id, userId: ctx.appUser.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  if (collectionId) {
    const col = await prisma.collection.findFirst({
      where: { id: collectionId, userId: ctx.appUser.id },
    });
    if (!col) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 400 }
      );
    }
  }

  try {
    let noteUpdate: string | null | undefined;
    if (note !== undefined) {
      if (note === null) noteUpdate = null;
      else {
        const t = note.trim();
        noteUpdate = t === "" ? null : t;
      }
    }

    const titleUpdate = title !== undefined
      ? (title === null ? null : (title.trim() || null))
      : undefined;

    const link = await prisma.link.update({
      where: { id },
      data: {
        ...(collectionId !== undefined ? { collectionId } : {}),
        ...(note !== undefined ? { note: noteUpdate } : {}),
        ...(title !== undefined ? { title: titleUpdate } : {}),
        ...(isPublic !== undefined ? { isPublic } : {}),
      },
    });
    return NextResponse.json({ link: serializeLink(link) });
  } catch {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  const ctx = await getAuthenticatedAppUser();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = context.params;
  const existing = await prisma.link.findFirst({
    where: { id, userId: ctx.appUser.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  try {
    await prisma.link.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }
}
