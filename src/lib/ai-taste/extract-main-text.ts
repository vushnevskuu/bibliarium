import * as cheerio from "cheerio";
import { safeFetch } from "@/lib/url-security";

/**
 * Cheap main-text extraction for article-like pages (no Readability in MVP).
 */
export async function extractMainTextFromUrl(
  url: string,
  maxChars = 12000,
  timeoutMs = 18_000
): Promise<string | null> {
  try {
    const res = await safeFetch(url, {
      headers: { Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8" },
      timeoutMs,
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    $("script, style, nav, footer, noscript, iframe, svg, template").remove();
    const text = $("body").text().replace(/\s+/g, " ").trim();
    if (!text) return null;
    return text.slice(0, maxChars);
  } catch {
    return null;
  }
}
