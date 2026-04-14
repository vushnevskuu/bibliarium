import { NextResponse } from "next/server";
import { getAuthenticatedAppUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getAuthenticatedAppUser();
  if (!ctx) {
    return NextResponse.json({ user: null });
  }
  const u = ctx.appUser;
  return NextResponse.json({
    user: {
      id: u.id,
      email: u.email,
      slug: u.slug,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      aiProfilePublic: u.aiProfilePublic,
    },
  });
}
