"use client";

import * as React from "react";
import type { LinkSerialized } from "@/types/link";
import { LinkCard } from "./link-card";
import { VirtualMasonryColumns } from "@/components/board/virtual-masonry-columns";
import type { MasonryFlatItem } from "@/components/board/masonry-height-estimate";

function useMasonryCols(
  containerRef: React.RefObject<HTMLDivElement>,
  minColWidth = 300,
  gap = 20,
) {
  const [cols, setCols] = React.useState(3);
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const n = Math.max(1, Math.floor((el.offsetWidth + gap) / (minColWidth + gap)));
      setCols(n);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, minColWidth, gap]);
  return cols;
}

const noop = () => {};

export function PublicBoard({
  handle,
  links,
}: {
  handle: string;
  links: LinkSerialized[];
}) {
  const gridRef = React.useRef<HTMLDivElement>(null);
  const numCols = useMasonryCols(gridRef);

  const masonryItems = React.useMemo(
    (): MasonryFlatItem[] =>
      links.map((link) => ({ kind: "link" as const, link })),
    [links]
  );

  const renderPublicItem = React.useCallback((item: MasonryFlatItem) => {
    if (item.kind !== "link") {
      return <div className="h-px w-full shrink-0" aria-hidden />;
    }
    return (
      <LinkCard
        link={item.link}
        onOpen={noop}
        onDelete={noop}
        readOnly
      />
    );
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="min-w-0 px-10 pb-10 pt-10">
        {/* Header — show public handle, not email */}
        <div className="mb-8 text-center">
          <p className="text-[18px] font-medium tracking-tight text-foreground">
            {handle}
          </p>
        </div>

        {/* Masonry grid */}
        <div
          ref={gridRef}
          className={links.length === 0 ? "hidden" : "flex items-start gap-5"}
        >
          <VirtualMasonryColumns
            gridRef={gridRef}
            items={masonryItems}
            numCols={numCols}
            renderItem={renderPublicItem}
          />
        </div>
        {links.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">No links yet.</p>
        )}
      </main>
    </div>
  );
}
