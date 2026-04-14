import { headers } from "next/headers";

/**
 * Public origin for absolute links on the current request.
 * Avoids broken export URLs when dev runs on a port other than NEXT_PUBLIC_APP_URL.
 */
export function requestPublicBaseUrl(): string {
  const envBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  try {
    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) return envBase;
    const proto = h.get("x-forwarded-proto") ?? "http";
    return `${proto}://${host}`;
  } catch {
    return envBase;
  }
}
