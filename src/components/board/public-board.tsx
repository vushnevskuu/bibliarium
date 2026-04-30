"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import type { LinkSerialized } from "@/types/link";
import { LinkCard } from "./link-card";
import { useMasonryCols } from "./use-masonry-cols";

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
  const numCols = useMasonryCols(gridRef, { initialCols: 3 });

  const masonryColumns = React.useMemo(() => {
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
    items.forEach((item, i) => {
      columns[i % numCols]?.push(item);
    });
    return columns.map((col, ci) => (
      <div key={ci} className="flex min-w-0 flex-1 flex-col gap-5">
        {col}
      </div>
    ));
  }, [links, numCols, embedIsDark]);

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
          {masonryColumns}
        </div>
        {links.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">No links yet.</p>
        )}
      </main>
    </div>
  );
}
