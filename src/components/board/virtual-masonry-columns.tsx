"use client";

import * as React from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  estimateMasonryItemPx,
  type MasonryFlatItem,
} from "@/components/board/masonry-height-estimate";

const GAP_PX = 20;

/** Раскладка как у прежней masonry: round-robin по колонкам */
export function distributeIntoColumns<T>(
  items: T[],
  numCols: number
): T[][] {
  const cols: T[][] = Array.from({ length: Math.max(1, numCols) }, () => []);
  items.forEach((item, i) => {
    cols[i % numCols]?.push(item);
  });
  return cols;
}

function MasonryColumn({
  items,
  scrollMargin,
  gap,
  renderItem,
}: {
  items: MasonryFlatItem[];
  scrollMargin: number;
  gap: number;
  renderItem: (item: MasonryFlatItem) => React.ReactNode;
}) {
  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: (index) =>
      items[index] ? estimateMasonryItemPx(items[index]) : 320,
    overscan: 6,
    gap,
    scrollMargin,
    getItemKey: (index) => {
      const row = items[index];
      if (!row) return index;
      return row.kind === "link" ? row.link.id : row.id;
    },
  });

  const total = virtualizer.getTotalSize();
  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="min-w-0 flex-1">
      <div
        className="relative w-full"
        style={{ height: total }}
      >
        {virtualItems.map((v) => (
          <div
            key={String(v.key)}
            data-index={v.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${v.start}px)`,
            }}
          >
            {renderItem(items[v.index]!)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function VirtualMasonryColumns({
  gridRef,
  items,
  numCols,
  renderItem,
}: {
  gridRef: React.RefObject<HTMLDivElement | null>;
  items: MasonryFlatItem[];
  numCols: number;
  renderItem: (item: MasonryFlatItem) => React.ReactNode;
}) {
  const [scrollMargin, setScrollMargin] = React.useState(0);

  const cols = React.useMemo(
    () => distributeIntoColumns(items, numCols),
    [items, numCols]
  );

  React.useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const sync = () => {
      const rect = el.getBoundingClientRect();
      setScrollMargin(rect.top + window.scrollY);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [gridRef, numCols, items.length]);

  if (items.length === 0) return null;

  return (
    <>
      {cols.map((col, ci) => (
        <MasonryColumn
          key={ci}
          items={col}
          scrollMargin={scrollMargin}
          gap={GAP_PX}
          renderItem={renderItem}
        />
      ))}
    </>
  );
}
