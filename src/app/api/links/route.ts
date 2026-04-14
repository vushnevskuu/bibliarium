import { NextResponse } from "next/server";
import { buildLinkAiProfile } from "@/lib/ai-taste/build-link-profile";
import { extractMainTextFromUrl } from "@/lib/ai-taste/extract-main-text";
import { getAuthenticatedAppUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { serializeLink } from "@/lib/serialize";
import { resolvePreview } from "@/lib/preview-resolver";
import { normalizeUrlString } from "@/lib/url-parse";
import { assertUrlSafeForFetch } from "@/lib/url-security";
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

  try {
    try {
      assertUrlSafeForFetch(
        /^https?:\/\//i.test(rawUrl.trim())
          ? rawUrl.trim()
          : `https://${rawUrl.trim()}`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid URL";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeUrlString(rawUrl);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const existing = await prisma.link.findUnique({
      where: {
        userId_normalizedUrl: {
          userId: ctx.appUser.id,
          normalizedUrl,
        },
      },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: "This link is already on the board",
          code: "DUPLICATE",
          link: serializeLink(existing),
        },
        { status: 409 }
      );
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

    const sortAgg = await prisma.link.aggregate({
      where: { userId: ctx.appUser.id },
      _max: { sortOrder: true },
    });
    const nextSortOrder = (sortAgg._max.sortOrder ?? 0) + 1;

    let preview;
    try {
      preview = await resolvePreview(rawUrl);
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Could not fetch a preview for this URL";
      return NextResponse.json({ error: msg }, { status: 422 });
    }

    let extractedText: string | null = null;
    if (preview.provider === "article" || preview.provider === "web") {
      extractedText = await extractMainTextFromUrl(
        preview.normalizedUrl,
        12000,
        10_000
      );
    }

    const oa =
      preview.oEmbedJson &&
      typeof preview.oEmbedJson.author_name === "string"
        ? preview.oEmbedJson.author_name
        : null;

    const aiProfile = buildLinkAiProfile({
      normalizedUrl: preview.normalizedUrl,
      url: preview.url,
      canonicalUrl: null,
      title: preview.title,
      description: preview.description,
      domain: preview.domain,
      provider: preview.provider,
      previewType: preview.previewType,
      imageUrl: preview.imageUrl,
      faviconUrl: preview.faviconUrl,
      siteName: preview.siteName,
      author: oa,
      publishedAt: null,
      extractedText,
      oEmbedAuthor: oa,
    });

    const link = await prisma.link.create({
      data: {
        sortOrder: nextSortOrder,
        url: preview.url,
        normalizedUrl: preview.normalizedUrl,
        title: preview.title,
        description: preview.description,
        imageUrl: preview.imageUrl,
        faviconUrl: preview.faviconUrl,
        siteName: preview.siteName,
        domain: preview.domain,
        provider: preview.provider,
        previewType: preview.previewType,
        embedHtml: preview.embedHtml,
        embedUrl: preview.embedUrl,
        oEmbedJson:
          preview.oEmbedJson === null
            ? null
            : JSON.stringify(preview.oEmbedJson),
        tagsJson: "[]",
        collectionId: collectionId ?? undefined,
        userId: ctx.appUser.id,
        extractedText,
        aiProfileJson: JSON.stringify(aiProfile),
        ingestionStatus: "complete",
      },
    });

    return NextResponse.json({ link: serializeLink(link) }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/links]", e);
    const message =
      e instanceof Error ? e.message : "Could not save link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
