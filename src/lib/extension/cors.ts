/**
 * CORS for browser extensions (MV3: Origin is chrome-extension://…).
 */
export function isExtensionOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return (
    origin.startsWith("chrome-extension://") ||
    origin.startsWith("moz-extension://")
  );
}

export function applyExtensionCors(
  request: Request,
  headers: Headers
): void {
  const origin = request.headers.get("origin");
  if (origin && isExtensionOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, X-Requested-With"
  );
  headers.set("Access-Control-Max-Age", "86400");
}

export function extensionOptionsResponse(request: Request): Response {
  const headers = new Headers();
  applyExtensionCors(request, headers);
  return new Response(null, { status: 204, headers });
}
