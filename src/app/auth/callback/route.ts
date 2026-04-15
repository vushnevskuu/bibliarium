import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/safe-next";
import { resolveSupabaseFromProcessEnv } from "@/lib/supabase/resolve-env";

/**
 * Важно для App Router: куки сессии должны писаться на тот же `NextResponse`,
 * что и `redirect`. Иначе `exchangeCodeForSession` отрабатывает, но Set-Cookie
 * не уезжает с ответом — вход «ломается» без явной ошибки в UI.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(requestUrl.searchParams.get("next"));
  const cfg = resolveSupabaseFromProcessEnv();

  if (!cfg) {
    return NextResponse.redirect(
      new URL("/auth/signin?error=missing_config", requestUrl.origin)
    );
  }

  if (!code) {
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
    const fail = new URL("/auth/signin", requestUrl.origin);
    fail.searchParams.set("error", "auth_callback");
    const msg = error.message.slice(0, 180);
    if (msg) fail.searchParams.set("detail", msg);
    return NextResponse.redirect(fail);
  }

  return response;
}
