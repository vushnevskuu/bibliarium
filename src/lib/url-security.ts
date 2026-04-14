/**
 * Basic SSRF protection: http(s) only, block loopback and private ranges.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

function isIPv4(host: string): [number, number, number, number] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const parts = m.slice(1, 5).map((x) => Number(x));
  if (parts.some((n) => n > 255)) return null;
  return parts as [number, number, number, number];
}

function isPrivateIPv4(a: number, b: number, c: number): boolean {
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0 && c === 0) return true;
  if (a === 192 && b === 0 && c === 2) return true; // documentation
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true; // multicast / reserved
  return false;
}

export function assertUrlSafeForFetch(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  const protocol = url.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS are allowed");
  }

  const host = url.hostname.toLowerCase();
  if (!host) throw new Error("Empty host");

  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new Error("Host is not allowed");
  }
  if (host.endsWith(".local") || host.endsWith(".localhost")) {
    throw new Error("Host is not allowed");
  }

  const ipv4 = isIPv4(host);
  if (ipv4 && isPrivateIPv4(ipv4[0], ipv4[1], ipv4[2])) {
    throw new Error("Private addresses are not allowed");
  }

  if (host.includes(":") && !host.startsWith("[")) {
    // Rare unbracketed IPv6 — block obvious loopback
    if (host === "::1") throw new Error("Address is not allowed");
  }
  if (host.startsWith("[") && host.endsWith("]")) {
    const inner = host.slice(1, -1).toLowerCase();
    if (inner === "::1" || inner.startsWith("fe80:") || inner.startsWith("fc") || inner.startsWith("fd")) {
      throw new Error("Address is not allowed");
    }
  }

  return url;
}

const MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT_MS = 18_000;

export type SafeFetchOptions = RequestInit & {
  maxRedirects?: number;
  timeoutMs?: number;
};

/** fetch with manual redirect handling and URL re-validation */
export async function safeFetch(
  initial: string,
  options: SafeFetchOptions = {}
): Promise<Response> {
  const {
    maxRedirects = MAX_REDIRECTS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    ...fetchInit
  } = options;
  let current = assertUrlSafeForFetch(initial);
  let redirects = 0;

  for (;;) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(current.toString(), {
        ...fetchInit,
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "BibliariumPreview/1.0",
          Accept:
            "text/html,application/xhtml+xml,application/json;q=0.9,image/*;q=0.8,*/*;q=0.7",
          ...fetchInit.headers,
        },
      });
    } finally {
      clearTimeout(t);
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc || redirects >= maxRedirects) {
        throw new Error("Too many redirects or missing Location");
      }
      redirects += 1;
      const next = new URL(loc, current);
      current = assertUrlSafeForFetch(next.toString());
      continue;
    }

    return res;
  }
}
