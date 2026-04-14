/**
 * Only same-origin paths are allowed (prevents open redirects after OAuth / magic link).
 */
export function safeNextPath(raw: string | null): string {
  if (!raw || typeof raw !== "string") return "/board";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/board";
  try {
    const u = new URL(trimmed, "http://local.invalid");
    if (u.protocol !== "http:") return "/board";
    if (!u.pathname.startsWith("/") || u.pathname.startsWith("//")) {
      return "/board";
    }
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return "/board";
  }
}
