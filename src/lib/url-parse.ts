import type { LinkProvider } from "@/types/link";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)(\?|$)/i;

export function normalizeUrlString(input: string): string {
  const trimmed = input.trim();
  const withProto =
    /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const u = new URL(withProto);
  u.hash = "";
  u.pathname = u.pathname.replace(/\/+$/, "") || "/";
  if (u.pathname === "/" && !u.search) {
    u.pathname = "/";
  }
  return u.toString();
}

/** Page URL is a Shorts link (youtube.com/shorts/VIDEO_ID). youtu.be/ID is ambiguous. */
export function isYoutubeShortsUrl(urlString: string): boolean {
  try {
    const u = new URL(urlString);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "youtube.com" && host !== "m.youtube.com") return false;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] !== "shorts" || !parts[1]) return false;
    const id = parts[1].split("?")[0];
    return /^[\w-]{11}$/.test(id);
  } catch {
    return false;
  }
}

export function extractYouTubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (url.pathname.startsWith("/watch")) {
      const v = url.searchParams.get("v");
      return v && /^[\w-]{11}$/.test(v) ? v : null;
    }
    if (url.pathname.startsWith("/embed/")) {
      const id = url.pathname.split("/")[2];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/live/")) {
      const id = url.pathname.split("/")[2];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
  }
  return null;
}

export function isInstagramHost(host: string): boolean {
  const h = host.replace(/^www\./, "").toLowerCase();
  return h === "instagram.com" || h === "m.instagram.com";
}

export function extractInstagramShortcode(
  url: URL
): { type: "p" | "reel" | "tv"; shortcode: string } | null {
  if (!isInstagramHost(url.hostname)) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length >= 2 && (parts[0] === "p" || parts[0] === "reel" || parts[0] === "tv")) {
    const shortcode = parts[1].split("?")[0];
    if (shortcode) return { type: parts[0] as "p" | "reel" | "tv", shortcode };
  }
  return null;
}

export function instagramEmbedUrl(type: "p" | "reel" | "tv", shortcode: string): string {
  if (type === "reel") return `https://www.instagram.com/reel/${shortcode}/embed/`;
  return `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
}

export function isTwitterHost(host: string): boolean {
  const h = host.replace(/^www\./, "").toLowerCase();
  return h === "twitter.com" || h === "x.com" || h === "mobile.twitter.com";
}

export function isTelegramHost(host: string): boolean {
  const h = host.replace(/^www\./, "").toLowerCase();
  return h === "t.me" || h === "telegram.me" || h === "telegram.dog";
}

const TELEGRAM_RESERVED_USERNAMES = new Set([
  "joinchat",
  "addstickers",
  "iv",
  "proxy",
  "login",
  "share",
  "setlanguage",
  "addemoji",
  "emoji",
]);

function isTelegramPublicUsername(s: string): boolean {
  if (/^\d+$/.test(s)) return false;
  return /^[a-zA-Z0-9_]{4,32}$/.test(s);
}

/**
 * Path for a single public post, e.g. `/durov/43` or `/c/123/456`, or null.
 */
export function parseTelegramPostPath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  if (parts[0] === "c" && parts.length >= 3) {
    if (/^\d+$/.test(parts[1]) && /^\d+$/.test(parts[2])) {
      return `/c/${parts[1]}/${parts[2]}`;
    }
    return null;
  }

  if (parts[0] === "s" && parts.length >= 3) {
    const username = parts[1];
    const msgId = parts[2];
    if (/^\d+$/.test(msgId) && isTelegramPublicUsername(username)) {
      return `/${username}/${msgId}`;
    }
    return null;
  }

  const username = parts[0];
  const msgId = parts[1];
  if (!/^\d+$/.test(msgId)) return null;
  if (TELEGRAM_RESERVED_USERNAMES.has(username.toLowerCase())) return null;
  if (!isTelegramPublicUsername(username)) return null;
  return `/${username}/${msgId}`;
}

/** Canonical embed page URL (`embed=1`, optional `dark=1`). */
export function buildTelegramPostEmbedPageUrl(
  pageUrl: URL,
  dark: boolean
): string | null {
  if (!isTelegramHost(pageUrl.hostname)) return null;
  const postPath = parseTelegramPostPath(pageUrl.pathname);
  if (!postPath) return null;
  /** Числовой id (`/c/…`) — официальный embed часто ломается / требует доступ; только ссылка в UI. */
  if (postPath.startsWith("/c/")) return null;
  const out = new URL(`https://t.me${postPath}`);
  out.searchParams.set("embed", "1");
  if (dark) out.searchParams.set("dark", "1");
  else out.searchParams.delete("dark");
  return out.toString();
}

export function resolveTelegramEmbedUrl(
  link: {
    url: string;
    normalizedUrl: string;
    embedUrl: string | null;
  },
  dark: boolean
): string | null {
  const candidates = [link.embedUrl, link.normalizedUrl, link.url].filter(
    Boolean
  ) as string[];
  for (const raw of candidates) {
    try {
      const u = new URL(raw);
      if (!isTelegramHost(u.hostname)) continue;
      const built = buildTelegramPostEmbedPageUrl(u, dark);
      if (built) return built;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function extractTweetIdFromUrl(urlString: string): string | null {
  try {
    const u = new URL(urlString);
    if (!isTwitterHost(u.hostname)) return null;
    const path = u.pathname;
    const patterns = [
      /\/status\/(\d+)/,
      /\/statuses\/(\d+)/,
      /\/i\/status\/(\d+)/,
    ];
    for (const p of patterns) {
      const m = p.exec(path);
      if (m?.[1]) return m[1];
    }
    return null;
  } catch {
    return null;
  }
}

/** oEmbed HTML often includes data-tweet-id or a canonical status URL */
export function extractTweetIdFromOembedHtml(
  html: string | null | undefined
): string | null {
  if (!html) return null;
  const data = /data-tweet-id="(\d+)"/.exec(html);
  if (data?.[1]) return data[1];
  const tw = /(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/i.exec(html);
  if (tw?.[1]) return tw[1];
  return null;
}

export function tweetEmbedUrlForTweetId(
  tweetId: string,
  theme: "light" | "dark"
): string {
  const t = theme === "dark" ? "dark" : "light";
  return `https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=${t}&dnt=true&conversation=none`;
}

export function tweetEmbedIframeSrc(
  urlString: string,
  theme: "light" | "dark"
): string | null {
  return resolveTwitterEmbedSrc(urlString, null, theme);
}

/** Prefer status URL; fall back to tweet id inside oEmbed HTML */
export function resolveTwitterEmbedSrc(
  url: string,
  embedHtml: string | null | undefined,
  theme: "light" | "dark"
): string | null {
  const id = extractTweetIdFromUrl(url) ?? extractTweetIdFromOembedHtml(embedHtml);
  return id ? tweetEmbedUrlForTweetId(id, theme) : null;
}

export function isLikelyImagePath(url: URL): boolean {
  return IMAGE_EXT.test(url.pathname);
}

export function detectProvider(url: URL): LinkProvider {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (extractYouTubeId(url)) return "youtube";
  if (isTwitterHost(host)) return "twitter";
  if (isInstagramHost(host) && extractInstagramShortcode(url)) return "instagram";
  if (isTelegramHost(host) && parseTelegramPostPath(url.pathname))
    return "telegram";
  if (isLikelyImagePath(url)) return "image";
  return "web";
}

export function domainFromUrl(url: URL): string {
  return url.hostname.replace(/^www\./, "").toLowerCase();
}
