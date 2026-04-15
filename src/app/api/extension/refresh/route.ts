import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  applyExtensionCors,
  extensionOptionsResponse,
} from "@/lib/extension/cors";
import { isSupabaseConfigured } from "@/lib/auth/session";
import { extensionRefreshBodySchema } from "@/lib/validation";
import { resolveSupabaseFromProcessEnv } from "@/lib/supabase/resolve-env";

export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return extensionOptionsResponse(request);
}

export async function POST(request: Request) {
  const headers = new Headers();
  applyExtensionCors(request, headers);

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Auth not configured" },
      { status: 503, headers }
    );
  }

  const cfg = resolveSupabaseFromProcessEnv();
  if (!cfg) {
    return NextResponse.json(
      { error: "Auth not configured" },
      { status: 503, headers }
    );
  }
  const { url, anonKey: key } = cfg;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers }
    );
  }

  const parsed = extensionRefreshBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400, headers }
    );
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: parsed.data.refresh_token,
  });

  if (error || !data.session) {
    return NextResponse.json(
      { error: error?.message ?? "Refresh failed" },
      { status: 401, headers }
    );
  }

  const s = data.session;
  return NextResponse.json(
    {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: s.expires_at,
      expires_in: s.expires_in,
      token_type: s.token_type,
    },
    { headers }
  );
}
