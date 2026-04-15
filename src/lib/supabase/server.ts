import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { resolveSupabaseFromProcessEnv } from "@/lib/supabase/resolve-env";

export function createClient() {
  const cfg = resolveSupabaseFromProcessEnv();
  if (!cfg) {
    throw new Error(
      "Missing Supabase env: set SUPABASE_URL + SUPABASE_ANON_KEY and/or NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  const { url, anonKey: key } = cfg;
  const cookieStore = cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options: CookieOptions;
        }[]
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          /* ignore when called from a Server Component without mutable cookies */
        }
      },
    },
  });
}
