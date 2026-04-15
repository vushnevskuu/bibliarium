import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/safe-next";
import { resolveSupabaseFromProcessEnv } from "@/lib/supabase/resolve-env";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(requestUrl.searchParams.get("next"));
  const cfg = resolveSupabaseFromProcessEnv();

  if (!cfg) {
    return NextResponse.redirect(
      new URL("/auth/signin?error=missing_config", requestUrl.origin)
    );
  }

  if (!token_hash || !type) {
    return NextResponse.redirect(
      new URL("/auth/signin?error=expired_link", requestUrl.origin)
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

  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash,
  });

  if (error) {
    return NextResponse.redirect(
      new URL("/auth/signin?error=expired_link", requestUrl.origin)
    );
  }

  return response;
}
