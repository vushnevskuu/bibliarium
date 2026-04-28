import type { LinkSerialized } from "@/types/link";
import { linkHeightTier } from "@/lib/masonry-pack";

/** Пиксели для начальной оценки блока (до измерения через measureElement). */
export type MasonryFlatItem =
  | { kind: "link"; link: LinkSerialized }
  | { kind: "skeleton"; id: string };

export function estimateMasonryItemPx(item: MasonryFlatItem): number {
  if (item.kind === "skeleton") return 360;
  const t = linkHeightTier(item.link);
  return Math.round(200 + t * 4.25);
}
