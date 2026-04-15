import { NextResponse } from "next/server";
import { getAppUserFromBearer, getBearerToken } from "@/lib/extension/bearer-auth";
import {
  applyExtensionCors,
  extensionOptionsResponse,
} from "@/lib/extension/cors";

export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return extensionOptionsResponse(request);
}

export async function GET(request: Request) {
  const headers = new Headers();
  applyExtensionCors(request, headers);

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json(
      { authenticated: false, error: "Missing Authorization bearer token" },
      { status: 401, headers }
    );
  }

  const ctx = await getAppUserFromBearer(token);
  if (!ctx) {
    return NextResponse.json(
      { authenticated: false, error: "Invalid or expired session" },
      { status: 401, headers }
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      user: {
        id: ctx.appUser.id,
        slug: ctx.appUser.slug,
        email: ctx.appUser.email,
        displayName: ctx.appUser.displayName,
      },
    },
    { headers }
  );
}
