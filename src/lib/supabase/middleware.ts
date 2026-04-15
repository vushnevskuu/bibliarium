import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveSupabaseFromProcessEnv } from "@/lib/supabase/resolve-env";

const AUTH_REQUIRED_PREFIXES = ["/board", "/analysis"];

function isAuthRequiredPath(pathname: string): boolean {
  return AUTH_REQUIRED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export async function updateSession(request: NextRequest) {
  const cfg = resolveSupabaseFromProcessEnv();

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  if (!cfg) {
    return response;
  }

  const { url, anonKey: key } = cfg;

  const supabase = createServerClient(url, key, {
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
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({
          request: { headers: request.headers },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && request.nextUrl.pathname === "/") {
    const u = request.nextUrl.clone();
    u.pathname = "/board";
    u.search = "";
    return NextResponse.redirect(u);
  }

  if (user && request.nextUrl.pathname.startsWith("/auth/signin")) {
    return NextResponse.redirect(new URL("/board", request.url));
  }

  if (!user && isAuthRequiredPath(request.nextUrl.pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth/signin";
    redirectUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
