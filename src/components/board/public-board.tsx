"use client";

import * as React from "react";
import type { LinkSerialized } from "@/types/link";
import { LinkCard } from "./link-card";

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
  email,
  links,
}: {
  email: string | null;
  links: LinkSerialized[];
}) {
  const gridRef = React.useRef<HTMLDivElement>(null);
  const numCols = useMasonryCols(gridRef);

  const items: React.ReactNode[] = links.map((link) => (
    <LinkCard
      key={link.id}
      link={link}
      onOpen={noop}
      onDelete={noop}
      readOnly
    />
  ));

  const columns: React.ReactNode[][] = Array.from({ length: numCols }, () => []);
  items.forEach((item, i) => columns[i % numCols].push(item));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="min-w-0 px-10 pb-10 pt-10">
        {/* Header */}
        <div className="mb-8 text-center">
          <p className="text-[18px] font-medium tracking-tight text-foreground">
            {email}
          </p>
        </div>

        {/* Masonry grid */}
        {links.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">No links yet.</p>
        ) : (
          <div ref={gridRef} className="flex items-start gap-5">
            {columns.map((col, ci) => (
              <div key={ci} className="flex flex-1 flex-col gap-5 min-w-0">
                {col}
              </div>
            ))}
          </div>
        )}

        {links.length === 0 && (
          <div ref={gridRef} className="hidden" />
        )}
      </main>
    </div>
  );
}
