import { NextResponse } from "next/server";
import { getAuthenticatedAppUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { patchUserBodySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
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

  const parsed = patchUserBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data: { aiProfilePublic?: boolean; openaiApiKey?: string | null } = {};
  if (parsed.data.aiProfilePublic !== undefined) {
    data.aiProfilePublic = parsed.data.aiProfilePublic;
  }
  if (parsed.data.openaiApiKey !== undefined) {
    // null = remove key, string = set key (basic format check)
    const k = parsed.data.openaiApiKey;
    if (k !== null && !k.startsWith("sk-")) {
      return NextResponse.json({ error: "Invalid OpenAI API key format" }, { status: 400 });
    }
    data.openaiApiKey = k;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: ctx.appUser.id },
    data,
  });

  return NextResponse.json({
    user: {
      id: updated.id,
      email: updated.email,
      slug: updated.slug,
      displayName: updated.displayName,
      avatarUrl: updated.avatarUrl,
      aiProfilePublic: updated.aiProfilePublic,
      // Return only whether a key is set — never the actual value
      hasOpenaiKey: Boolean(updated.openaiApiKey),
    },
  });
}
