import { createClient } from "@/lib/supabase/server";
import { syncAppUserFromSupabase } from "@/lib/auth/sync-app-user";
import { resolveSupabaseFromProcessEnv } from "@/lib/supabase/resolve-env";
import type { User } from "@prisma/client";

export function isSupabaseConfigured(): boolean {
  return resolveSupabaseFromProcessEnv() !== null;
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
