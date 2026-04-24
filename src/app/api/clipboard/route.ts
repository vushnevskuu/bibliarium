import { NextResponse } from "next/server";
import { getAuthenticatedAppUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  savePastedImageDataUrlForUser,
  savePastedTextForUser,
} from "@/lib/save-clipboard-item";
import { serializeLink } from "@/lib/serialize";
import { clipboardPasteBodySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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

  const parsed = clipboardPasteBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const userRecord = await prisma.user.findUnique({
    where: { id: ctx.appUser.id },
    select: { openaiApiKey: true },
  });

  const openaiApiKey = userRecord?.openaiApiKey ?? null;
  const base = {
    userId: ctx.appUser.id,
    openaiApiKey,
    collectionId: parsed.data.collectionId ?? null,
  };

  const result =
    parsed.data.kind === "text"
      ? await savePastedTextForUser({ ...base, text: parsed.data.text })
      : await savePastedImageDataUrlForUser({
          ...base,
          dataUrl: parsed.data.dataUrl,
        });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, fieldErrors: result.fieldErrors },
      { status: result.status }
    );
  }

  return NextResponse.json(
    { link: serializeLink(result.link) },
    { status: 201 }
  );
}
