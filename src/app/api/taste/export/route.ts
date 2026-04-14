import { NextResponse } from "next/server";
import { masterProfileToMarkdown } from "@/lib/ai-taste/build-master-profile";
import { buildTasteExportForSlug } from "@/lib/ai-taste/export-payload";
import { getAuthenticatedAppUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  if (!slug?.trim()) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const profileUser = await prisma.user.findUnique({
    where: { slug: slug.trim() },
  });
  if (!profileUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const ctx = await getAuthenticatedAppUser();
  const isOwner = ctx?.appUser.id === profileUser.id;
  if (!profileUser.aiProfilePublic && !isOwner) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const built = await buildTasteExportForSlug(slug.trim());
  if (!built) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const format = searchParams.get("format") ?? "json";

  if (format === "md" || format === "markdown") {
    const md = masterProfileToMarkdown(built.master, built.json.link_ids);
    return new NextResponse(md, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json(built.json, {
    headers: { "Cache-Control": "no-store" },
  });
}
