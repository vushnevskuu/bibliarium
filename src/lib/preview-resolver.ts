import {
  buildTelegramPostEmbedPageUrl,
  detectProvider,
  domainFromUrl,
  extractYouTubeId,
  isLikelyImagePath,
  isTelegramHost,
  isTwitterHost,
  normalizeUrlString,
} from "@/lib/url-parse";
import { extractFromHtml, inferProviderFromOg } from "@/lib/og-extract";
import { assertUrlSafeForFetch, safeFetch } from "@/lib/url-security";
import { faviconForDomain } from "@/lib/utils";
import type { LinkProvider, PreviewType } from "@/types/link";

/** Сохраняем ссылку как есть: без embed (инвайты, закрытые каналы, нестандартный путь). */
function previewTelegramLinkOnly(
  url: URL,
  domain: string,
  faviconUrl: string | null
): ResolvedPreview {
  const u = url.toString();
  return {
    url: u,
    normalizedUrl: u,
    domain,
    title: "Telegram",
    description: null,
    imageUrl: null,
    faviconUrl,
    siteName: "Telegram",
    provider: "telegram",
    previewType: "fallback",
    embedHtml: null,
    embedUrl: null,
    oEmbedJson: null,
  };
}

export type ResolvedPreview = {
  url: string;
  normalizedUrl: string;
  domain: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  faviconUrl: string | null;
  siteName: string | null;
  provider: LinkProvider;
  previewType: PreviewType;
  embedHtml: string | null;
  embedUrl: string | null;
  oEmbedJson: Record<string, unknown> | null;
};

async function fetchJsonSafe(url: string): Promise<unknown> {
  const res = await safeFetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`oEmbed returned HTTP ${res.status}`);
  return res.json() as Promise<unknown>;
}

async function tryTwitterOembed(pageUrl: string): Promise<{
  html?: string;
  title?: string;
  author_name?: string;
} | null> {
  const endpoint = `https://publish.twitter.com/oembed?url=${encodeURIComponent(
    pageUrl
  )}&omit_script=true&lang=ru`;
  try {
    const res = await safeFetch(endpoint, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      html?: string;
      title?: string;
      author_name?: string;
    };
  } catch {
    return null;
  }
}

async function tryOembedFromDiscovery(href: string): Promise<{
  html?: string;
  title?: string;
  thumbnail_url?: string;
  author_name?: string;
  provider_name?: string;
} | null> {
  try {
    const j = (await fetchJsonSafe(href)) as Record<string, unknown>;
    if (typeof j !== "object" || !j) return null;
    return j as {
      html?: string;
      title?: string;
      thumbnail_url?: string;
      author_name?: string;
      provider_name?: string;
    };
  } catch {
    return null;
  }
}

async function probeDirectImage(url: URL): Promise<boolean> {
  try {
    let res = await safeFetch(url.toString(), { method: "HEAD" });
    if (res.ok) {
      const ct = res.headers.get("content-type") || "";
      if (ct.startsWith("image/")) return true;
    }
    res = await safeFetch(url.toString(), {
      method: "GET",
      headers: { Range: "bytes=0-1024" },
    });
    const ct = res.headers.get("content-type") || "";
    return ct.startsWith("image/");
  } catch {
    return false;
  }
}

export async function resolvePreview(rawInput: string): Promise<ResolvedPreview> {
  let normalized: string;
  try {
    normalized = normalizeUrlString(rawInput);
  } catch {
    throw new Error("Could not parse URL");
  }

  const url = assertUrlSafeForFetch(normalized);
  const domain = domainFromUrl(url);
  const baseFavicon = faviconForDomain(domain);
  let provider = detectProvider(url);
  let previewType: PreviewType = "fallback";
  let embedHtml: string | null = null;
  let embedUrl: string | null = null;
  let oEmbedJson: Record<string, unknown> | null = null;
  let title: string | null = null;
  let description: string | null = null;
  let imageUrl: string | null = null;
  let siteName: string | null = null;
  let faviconUrl: string | null = baseFavicon;

  const yt = extractYouTubeId(url);
  if (yt) {
    embedUrl = `https://www.youtube-nocookie.com/embed/${yt}`;
    previewType = "embed";
    provider = "youtube";
    title = `YouTube · ${yt}`;
    imageUrl = `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
    return {
      url: url.toString(),
      normalizedUrl: url.toString(),
      domain,
      title,
      description,
      imageUrl,
      faviconUrl,
      siteName: "YouTube",
      provider,
      previewType,
      embedHtml,
      embedUrl,
      oEmbedJson,
    };
  }

  const tgEmbed = buildTelegramPostEmbedPageUrl(url, false);
  if (tgEmbed) {
    previewType = "embed";
    provider = "telegram";
    embedUrl = tgEmbed;
    title = title || "Telegram";
    siteName = "Telegram";
    return {
      url: url.toString(),
      normalizedUrl: url.toString(),
      domain,
      title,
      description,
      imageUrl,
      faviconUrl,
      siteName,
      provider,
      previewType,
      embedHtml,
      embedUrl,
      oEmbedJson,
    };
  }

  if (isTelegramHost(url.hostname)) {
    return previewTelegramLinkOnly(url, domain, faviconUrl);
  }

  if (isTwitterHost(url.hostname)) {
    const tw = await tryTwitterOembed(url.toString());
    if (tw?.html) {
      previewType = "oembed";
      embedHtml = tw.html;
      title = tw.title || tw.author_name || "Post on X / Twitter";
      oEmbedJson = tw as Record<string, unknown>;
      provider = "twitter";
      return {
        url: url.toString(),
        normalizedUrl: url.toString(),
        domain,
        title,
        description,
        imageUrl,
        faviconUrl,
        siteName: "X (Twitter)",
        provider,
        previewType,
        embedHtml,
        embedUrl,
        oEmbedJson,
      };
    }
  }

  if (provider === "image" || isLikelyImagePath(url)) {
    const ok = await probeDirectImage(url);
    if (ok) {
      previewType = "image";
      imageUrl = url.toString();
      title = url.pathname.split("/").pop() || "Image";
      provider = "image";
      return {
        url: url.toString(),
        normalizedUrl: url.toString(),
        domain,
        title,
        description,
        imageUrl,
        faviconUrl,
        siteName: null,
        provider,
        previewType,
        embedHtml,
        embedUrl,
        oEmbedJson,
      };
    }
    provider = "web";
  }

  const htmlRes = await safeFetch(url.toString(), { method: "GET" });
  if (!htmlRes.ok) {
    // Return a minimal fallback so the link is saved even if the page blocks our bot
    return {
      url: url.toString(),
      normalizedUrl: url.toString(),
      domain,
      title: domain,
      description: null,
      imageUrl: null,
      faviconUrl,
      siteName: null,
      provider,
      previewType: "fallback" as PreviewType,
      embedHtml: null,
      embedUrl: null,
      oEmbedJson: null,
    };
  }
  // Check if the site allows iframe embedding
  const xfo = (htmlRes.headers.get("x-frame-options") || "").toUpperCase();
  const cspHeader = htmlRes.headers.get("content-security-policy") || "";
  const frameAncestors = (cspHeader.match(/frame-ancestors\s+([^;]+)/i)?.[1] ?? "").trim();
  const blocksEmbed =
    xfo.includes("DENY") ||
    xfo.includes("SAMEORIGIN") ||
    frameAncestors === "'none'" ||
    (frameAncestors !== "" && !frameAncestors.includes("*"));
  if (!blocksEmbed) {
    embedUrl = url.toString();
  }

  const contentType = htmlRes.headers.get("content-type") || "";
  if (contentType.startsWith("image/")) {
    previewType = "image";
    imageUrl = url.toString();
    title = url.pathname.split("/").pop() || "Image";
    provider = "image";
    return {
      url: url.toString(),
      normalizedUrl: url.toString(),
      domain,
      title,
      description,
      imageUrl,
      faviconUrl,
      siteName: null,
      provider,
      previewType,
      embedHtml,
      embedUrl,
      oEmbedJson,
    };
  }

  const html = await htmlRes.text();
  const og = extractFromHtml(html, url);
  if (og.faviconHref) faviconUrl = og.faviconHref;

  let usedOembed = false;
  if (og.oEmbedHref) {
    const oe = await tryOembedFromDiscovery(og.oEmbedHref);
    if (oe?.html) {
      usedOembed = true;
      previewType = "oembed";
      embedHtml = oe.html;
      oEmbedJson = oe as Record<string, unknown>;
      title = oe.title || og.title;
      imageUrl = oe.thumbnail_url
        ? (() => {
            try {
              return new URL(oe.thumbnail_url!, url).toString();
            } catch {
              return oe.thumbnail_url!;
            }
          })()
        : og.imageUrl;
      siteName = oe.provider_name || og.siteName;
    }
  }

  if (!usedOembed) {
    title = og.title;
    description = og.description;
    imageUrl = og.imageUrl;
    siteName = og.siteName;
    previewType = og.title || og.imageUrl ? "og" : "fallback";
    provider = inferProviderFromOg(provider, og.ogType);
  } else {
    description = og.description;
    provider = inferProviderFromOg(provider, og.ogType);
  }

  if (!title) {
    title = domain;
  }

  if (previewType === "fallback" && !imageUrl) {
    previewType = "fallback";
  }

  return {
    url: url.toString(),
    normalizedUrl: url.toString(),
    domain,
    title,
    description,
    imageUrl,
    faviconUrl,
    siteName,
    provider,
    previewType,
    embedHtml,
    embedUrl,
    oEmbedJson,
  };
}
