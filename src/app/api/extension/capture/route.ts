import { NextResponse } from "next/server";
import { getAppUserFromBearer, getBearerToken } from "@/lib/extension/bearer-auth";
import {
  applyExtensionCors,
  extensionOptionsResponse,
} from "@/lib/extension/cors";
import { saveCapturedLinkForUser } from "@/lib/save-captured-link";
import { serializeLink } from "@/lib/serialize";
import { extensionCaptureBodySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export function OPTIONS(request: Request) {
  return extensionOptionsResponse(request);
}

export async function POST(request: Request) {
  const headers = new Headers();
  applyExtensionCors(request, headers);

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  const ctx = await getAppUserFromBearer(token);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers }
    );
  }

  const parsed = extensionCaptureBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400, headers }
    );
  }

  const {
    url,
    title,
    faviconUrl: faviconClean,
    note,
    selectedText,
    source,
    collectionId,
    tags,
  } = parsed.data;

  const noteParts: string[] = [];
  if (note?.trim()) noteParts.push(note.trim());
  if (selectedText?.trim()) {
    noteParts.push(
      selectedText.trim().length > 4000
        ? `${selectedText.trim().slice(0, 4000)}…`
        : selectedText.trim()
    );
  }
  if (source) noteParts.push(`(saved via extension: ${source})`);
  const mergedNote = noteParts.length ? noteParts.join("\n\n") : null;

  const result = await saveCapturedLinkForUser({
    userId: ctx.appUser.id,
    rawUrl: url,
    collectionId: collectionId ?? null,
    note: mergedNote,
    tags: tags ?? [],
    titleHint: title ?? null,
    faviconHint: faviconClean,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, fieldErrors: result.fieldErrors },
      { status: result.status, headers }
    );
  }

  if (result.status === 409) {
    return NextResponse.json(
      {
        ok: true,
        duplicate: true,
        link: serializeLink(result.link),
      },
      { status: 409, headers }
    );
  }

  return NextResponse.json(
    { ok: true, link: serializeLink(result.link) },
    { status: 201, headers }
  );
}
