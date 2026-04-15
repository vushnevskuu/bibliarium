import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/safe-next";
import { resolveSupabaseFromProcessEnv } from "@/lib/supabase/resolve-env";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(requestUrl.searchParams.get("next"));
  const cfg = resolveSupabaseFromProcessEnv();

  console.log("[auth/callback] code present:", !!code, "cfg present:", !!cfg);

  if (!cfg) {
    console.error("[auth/callback] Supabase env not configured");
    return NextResponse.redirect(
      new URL("/auth/signin?error=missing_config", requestUrl.origin)
    );
  }

  if (!code) {
    console.error("[auth/callback] No code in URL:", requestUrl.toString());
    return NextResponse.redirect(
      new URL("/auth/signin?error=auth_callback", requestUrl.origin)
    );
  }

  const redirectTarget = new URL(next, requestUrl.origin);
  const response = NextResponse.redirect(redirectTarget);

  const supabase = createServerClient(cfg.url, cfg.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options: CookieOptions;
        }[]
      ) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession error:", error.message, error.code);
    const fail = new URL("/auth/signin", requestUrl.origin);
    fail.searchParams.set("error", "auth_callback");
    const msg = error.message.slice(0, 200);
    if (msg) fail.searchParams.set("detail", encodeURIComponent(msg));
    return NextResponse.redirect(fail);
  }

  console.log("[auth/callback] success, redirecting to:", redirectTarget.toString());
  return response;
}
