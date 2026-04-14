import type { LinkSerialized } from "@/types/link";
import {
  extractYouTubeId,
  isYoutubeShortsUrl,
  resolveTelegramEmbedUrl,
  resolveTwitterEmbedSrc,
} from "@/lib/url-parse";

/**
 * Если все веса равны, жадная «самая низкая колонка» с порогом по индексу
 * даёт тот же порядок, что и round-robin (i % n). Микродобавка от id ломает
 * равенство без заметного сдвига порядка категорий.
 */
function packMicroFromKey(key: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h & 127;
}

/**
 * Mirrors react-masonry-css breakpoint selection: smallest matching
 * `(windowWidth <= bp)` wins; `default` is the fallback column count.
 */
export function getMasonryColumnCount(
  windowWidth: number,
  breakpointCols: { default: number; [width: string]: number }
): number {
  let matchedBreakpoint = Infinity;
  let columns = breakpointCols.default;

  for (const breakpoint of Object.keys(breakpointCols)) {
    if (breakpoint === "default") continue;
    const optBreakpoint = Number.parseInt(breakpoint, 10);
    const isCurrent =
      optBreakpoint > 0 && windowWidth <= optBreakpoint;
    if (isCurrent && optBreakpoint < matchedBreakpoint) {
      matchedBreakpoint = optBreakpoint;
      columns = breakpointCols[breakpoint]!;
    }
  }

  return Math.max(1, Number.parseInt(String(columns), 10) || 1);
}

/** Greedy: each item goes to the currently shortest column (by summed weight). */
export function distributeByWeight(
  items: { key: string; weight: number }[],
  columnCount: number
): string[][] {
  if (columnCount <= 1) {
    return [items.map((i) => i.key)];
  }

  const cols: string[][] = Array.from({ length: columnCount }, () => []);
  const heights = new Array(columnCount).fill(0);

  for (const { key, weight } of items) {
    let best = 0;
    for (let c = 1; c < columnCount; c++) {
      if (heights[c] < heights[best]) best = c;
    }
    cols[best].push(key);
    heights[best] += weight;
  }

  return cols;
}

/** Грубые «этажи» высоты: чем больше, тем выше карточка в среднем. */
function linkHeightTier(link: LinkSerialized): number {
  if (link.provider === "youtube") {
    const shorts =
      isYoutubeShortsUrl(link.url) ||
      isYoutubeShortsUrl(link.normalizedUrl);
    if (shorts) return 90;
    let hasVideoArea = Boolean(link.embedUrl);
    if (!hasVideoArea) {
      try {
        hasVideoArea = Boolean(extractYouTubeId(new URL(link.url)));
      } catch {
        hasVideoArea = false;
      }
    }
    return hasVideoArea ? 72 : 55;
  }
  if (link.provider === "telegram") {
    return resolveTelegramEmbedUrl(link, false) ? 78 : 18;
  }
  if (link.provider === "twitter") {
    const src = resolveTwitterEmbedSrc(
      link.url,
      link.embedHtml,
      "light"
    );
    return src ? 75 : 32;
  }
  if (link.provider === "image" && link.imageUrl) {
    return 58;
  }
  if (link.imageUrl) {
    if (link.previewType === "embed") return 70;
    if (link.previewType === "oembed") return 62;
    if (link.previewType === "og") return 48;
    return 44;
  }
  if (link.previewType === "oembed") return 50;
  if (link.previewType === "og") return 35;
  if (link.previewType === "embed") return 65;
  return 30;
}

/**
 * Вес для жадной раскладки: крупный шаг по tier + микровес от id
 * (иначе og/web-карточки с одинаковым tier дают поведение как у react-masonry-css).
 */
export function estimateLinkCardHeight(link: LinkSerialized): number {
  return linkHeightTier(link) * 1000 + packMicroFromKey(link.id);
}

/** Скелетоны одного tier без джиттера снова = round-robin — даём вес от ключа. */
export function estimateSkeletonSlotWeight(key: string): number {
  return 38 * 1000 + packMicroFromKey(key);
}
