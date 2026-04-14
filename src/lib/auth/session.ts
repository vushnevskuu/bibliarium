import { createClient } from "@/lib/supabase/server";
import { syncAppUserFromSupabase } from "@/lib/auth/sync-app-user";
import type { User } from "@prisma/client";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

export async function getAuthenticatedAppUser(): Promise<{
  appUser: User;
} | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;
    const appUser = await syncAppUserFromSupabase(user);
    return { appUser };
  } catch {
    return null;
  }
}
