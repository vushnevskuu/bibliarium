import { NextResponse } from "next/server";
import { getAuthenticatedAppUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { serializeLink } from "@/lib/serialize";
import { saveCapturedLinkForUser } from "@/lib/save-captured-link";
import { createLinkBodySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
/** Long-running preview + extraction (local dev / slow hosts). */
export const maxDuration = 120;

export async function GET(request: Request) {
  const ctx = await getAuthenticatedAppUser();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const collectionId = searchParams.get("collectionId");

    const links = await prisma.link.findMany({
      where: {
        userId: ctx.appUser.id,
        ...(collectionId ? { collectionId } : {}),
      },
      orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({
      links: links.map(serializeLink),
    });
  } catch (e) {
    console.error("[GET /api/links]", e);
    const message =
      e instanceof Error ? e.message : "Could not load links";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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

  const parsed = createLinkBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { url: rawUrl, collectionId } = parsed.data;

  // Load user's OpenAI key — never expose it outside server
  const userRecord = await prisma.user.findUnique({
    where: { id: ctx.appUser.id },
    select: { openaiApiKey: true },
  });

  const result = await saveCapturedLinkForUser({
    userId: ctx.appUser.id,
    rawUrl,
    collectionId: collectionId ?? null,
    note: null,
    tags: [],
    openaiApiKey: userRecord?.openaiApiKey ?? null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, fieldErrors: result.fieldErrors },
      { status: result.status }
    );
  }

  if (result.status === 409) {
    return NextResponse.json(
      {
        error: "This link is already on the board",
        code: "DUPLICATE",
        link: serializeLink(result.link),
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ link: serializeLink(result.link) }, { status: 201 });
}
