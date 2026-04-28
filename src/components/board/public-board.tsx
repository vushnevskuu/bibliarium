"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import type { LinkSerialized } from "@/types/link";
import { LinkCard } from "./link-card";

function useMasonryCols(
  containerRef: React.RefObject<HTMLDivElement>,
  minColWidth = 300,
  gap = 20,
) {
  const [cols, setCols] = React.useState(3);
  const rafRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const schedule = () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const n = Math.max(1, Math.floor((el.offsetWidth + gap) / (minColWidth + gap)));
        setCols(n);
      });
    };
    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [containerRef, minColWidth, gap]);
  return cols;
}

const noopOpen = () => {};
const noopDelete: (id: string) => void = () => {};

export function PublicBoard({
  handle,
  links,
}: {
  handle: string;
  links: LinkSerialized[];
}) {
  const { resolvedTheme } = useTheme();
  const embedIsDark = resolvedTheme === "dark";
  const gridRef = React.useRef<HTMLDivElement>(null);
  const numCols = useMasonryCols(gridRef);

  const items: React.ReactNode[] = links.map((link) => (
    <LinkCard
      key={link.id}
      link={link}
      embedIsDark={embedIsDark}
      onOpen={noopOpen}
      onDelete={noopDelete}
      readOnly
    />
  ));

  const columns: React.ReactNode[][] = Array.from({ length: numCols }, () => []);
  items.forEach((item, i) => columns[i % numCols].push(item));

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
        <div ref={gridRef} className={links.length === 0 ? "hidden" : "flex items-start gap-5"}>
          {columns.map((col, ci) => (
            <div key={ci} className="flex flex-1 flex-col gap-5 min-w-0">
              {col}
            </div>
          ))}
        </div>
        {links.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">No links yet.</p>
        )}
      </main>
    </div>
  );
}
