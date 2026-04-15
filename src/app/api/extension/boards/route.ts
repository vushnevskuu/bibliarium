import { NextResponse } from "next/server";
import { getAppUserFromBearer, getBearerToken } from "@/lib/extension/bearer-auth";
import {
  applyExtensionCors,
  extensionOptionsResponse,
} from "@/lib/extension/cors";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return extensionOptionsResponse(request);
}

export async function GET(request: Request) {
  const headers = new Headers();
  applyExtensionCors(request, headers);

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers }
    );
  }

  const ctx = await getAppUserFromBearer(token);
  if (!ctx) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers }
    );
  }

  const collections = await prisma.collection.findMany({
    where: { userId: ctx.appUser.id },
    orderBy: [{ createdAt: "desc" }],
    include: { _count: { select: { links: true } } },
  });

  return NextResponse.json(
    {
      boards: collections.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        linkCount: c._count.links,
      })),
    },
    { headers }
  );
}
