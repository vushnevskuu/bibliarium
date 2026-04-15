import { createClient } from "@supabase/supabase-js";
import { syncAppUserFromSupabase } from "@/lib/auth/sync-app-user";
import type { User } from "@prisma/client";
import { isSupabaseConfigured } from "@/lib/auth/session";
import { resolveSupabaseFromProcessEnv } from "@/lib/supabase/resolve-env";

export function getBearerToken(request: Request): string | null {
  const h = request.headers.get("authorization");
  if (!h?.toLowerCase().startsWith("bearer ")) return null;
  const t = h.slice(7).trim();
  return t || null;
}

export async function getAppUserFromBearer(
  accessToken: string
): Promise<{ appUser: User } | null> {
  if (!isSupabaseConfigured()) return null;
  const cfg = resolveSupabaseFromProcessEnv();
  if (!cfg) return null;

  const supabase = createClient(cfg.url, cfg.anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const appUser = await syncAppUserFromSupabase(user);
  return { appUser };
}
