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

  let user: { id: string } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // If Supabase is unreachable, allow the request through — page-level auth will handle it
    return response;
  }

  const { pathname } = request.nextUrl;

  // Prevent redirect loops: never redirect if already going to the target
  if (user && pathname === "/" && !request.nextUrl.searchParams.has("no_redirect")) {
    const u = request.nextUrl.clone();
    u.pathname = "/board";
    u.search = "";
    return NextResponse.redirect(u);
  }

  if (user && pathname.startsWith("/auth/signin")) {
    const next = request.nextUrl.searchParams.get("next") ?? "/board";
    // Avoid loop if next === /auth/signin
    if (!next.startsWith("/auth/")) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  if (!user && isAuthRequiredPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth/signin";
    redirectUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
