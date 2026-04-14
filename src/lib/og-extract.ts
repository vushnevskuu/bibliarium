import * as cheerio from "cheerio";
import type { LinkProvider } from "@/types/link";

export type OgResult = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
  ogType: string | null;
  oEmbedHref: string | null;
  faviconHref: string | null;
};

function absolutize(base: URL, href: string | undefined): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export function extractFromHtml(html: string, pageUrl: URL): OgResult {
  const $ = cheerio.load(html);

  const meta = (prop: string) =>
    $(`meta[property="${prop}"]`).attr("content") ||
    $(`meta[name="${prop}"]`).attr("content") ||
    null;

  const oEmbedHref =
    $(`link[type="application/json+oembed"]`).attr("href") ||
    $(`link[type="text/json+oembed"]`).attr("href") ||
    null;

  const faviconHref =
    $(`link[rel="icon"]`).attr("href") ||
    $(`link[rel="shortcut icon"]`).attr("href") ||
    $(`link[rel="apple-touch-icon"]`).attr("href") ||
    null;

  const title =
    meta("og:title") ||
    meta("twitter:title") ||
    $("title").first().text().trim() ||
    null;

  const description =
    meta("og:description") ||
    meta("twitter:description") ||
    meta("description") ||
    null;

  const imageRaw =
    meta("og:image") ||
    meta("twitter:image") ||
    meta("twitter:image:src") ||
    null;

  const siteName = meta("og:site_name") || null;
  const ogType = meta("og:type") || null;

  return {
    title: title || null,
    description: description || null,
    imageUrl: absolutize(pageUrl, imageRaw || undefined),
    siteName,
    ogType,
    oEmbedHref: absolutize(pageUrl, oEmbedHref || undefined),
    faviconHref: absolutize(pageUrl, faviconHref || undefined),
  };
}

export function inferProviderFromOg(
  baseProvider: LinkProvider,
  ogType: string | null
): LinkProvider {
  if (baseProvider !== "web") return baseProvider;
  const t = (ogType || "").toLowerCase();
  if (t.includes("article")) return "article";
  return "web";
}
