import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

function slugBase(email: string | null, userId: string): string {
  if (email) {
    const local = email.split("@")[0] ?? "user";
    const s = local
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    return s || `user-${userId.slice(0, 8)}`;
  }
  return `user-${userId.slice(0, 8)}`;
}

export async function syncAppUserFromSupabase(authUser: SupabaseUser) {
  const email = authUser.email ?? null;
  const meta = authUser.user_metadata ?? {};
  const avatarUrl =
    typeof meta.avatar_url === "string"
      ? meta.avatar_url
      : typeof meta.picture === "string"
        ? meta.picture
        : null;
  const displayName =
    typeof meta.full_name === "string"
      ? meta.full_name
      : typeof meta.name === "string"
        ? meta.name
        : typeof meta.preferred_username === "string"
          ? meta.preferred_username
          : null;

  let authProvider = "email";
  const ident = authUser.identities?.[0];
  if (ident?.provider) authProvider = ident.provider;

  const existing = await prisma.user.findUnique({
    where: { id: authUser.id },
  });
  if (existing) {
    return prisma.user.update({
      where: { id: authUser.id },
      data: {
        email: email ?? undefined,
        displayName: displayName ?? undefined,
        avatarUrl: avatarUrl ?? undefined,
        authProvider,
      },
    });
  }

  const base = slugBase(email, authUser.id);
  let slug = base;
  for (let n = 0; n < 100; n++) {
    const clash = await prisma.user.findUnique({ where: { slug } });
    if (!clash) break;
    slug = `${base}-${n + 1}`;
  }

  return prisma.user.create({
    data: {
      id: authUser.id,
      email,
      slug,
      displayName,
      avatarUrl,
      authProvider,
      aiProfilePublic: false,
    },
  });
}
