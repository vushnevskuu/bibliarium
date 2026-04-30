"use client";

import * as React from "react";

/** Сколько колонок помещается в контейнер; пересчёт через rAF (ResizeObserver). */
export function useMasonryCols(
  containerRef: React.RefObject<HTMLDivElement>,
  options?: {
    minColWidth?: number;
    gap?: number;
    /** Начальное значение до первого измерения (избегаем мигания на SSR/гидрации). */
    initialCols?: number;
  },
) {
  const minColWidth = options?.minColWidth ?? 300;
  const gap = options?.gap ?? 20;
  const initialCols = options?.initialCols ?? 1;
  const [cols, setCols] = React.useState(initialCols);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const schedule = () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const n = Math.max(
          1,
          Math.floor((el.offsetWidth + gap) / (minColWidth + gap)),
        );
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
