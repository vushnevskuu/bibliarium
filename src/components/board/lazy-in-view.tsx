"use client";

import * as React from "react";
import { startTransition } from "react";
import { cn } from "@/lib/utils";

/**
 * Монтирует тяжёлое дерево (iframe и т.п.) только когда блок близко к viewport и
 * **размонтирует после ухода** (с паузой), чтобы не держать сотни iframe в DOM —
 * главная причина просадки FPS при длинном скролле.
 * Placeholder сохраняет ту же высоту, что и контент → masonry не прыгает.
 */
export function LazyInView({
  className,
  placeholder,
  children,
  /** Запас до/после экрана: подгрузка без «бесконечного» интерсекта */
  rootMargin = "140px 0px 180px 0px",
  /** После выхода из зоны — подождать, чтобы не дрожать у границы экрана */
  hideDelayMs = 340,
  /** Сразу монтировать без ожидания (например уже в зоне первого экрана) */
  eager = false,
}: {
  className?: string;
  placeholder: React.ReactNode;
  children: React.ReactNode;
  rootMargin?: string;
  hideDelayMs?: number;
  eager?: boolean;
}) {
  const [show, setShow] = React.useState(eager);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = React.useCallback(() => {
    if (hideTimerRef.current != null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    if (eager) return;

    const el = rootRef.current;
    if (!el) return;

    const reveal = () => {
      clearHideTimer();
      requestAnimationFrame(() => {
        startTransition(() => setShow(true));
      });
    };

    const armHide = () => {
      clearHideTimer();
      hideTimerRef.current = setTimeout(() => {
        hideTimerRef.current = null;
        startTransition(() => setShow(false));
      }, hideDelayMs);
    };

    const io = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.some((e) => e.isIntersecting);
        if (intersecting) reveal();
        else armHide();
      },
      { root: null, rootMargin, threshold: 0 },
    );

    io.observe(el);
    return () => {
      io.disconnect();
      clearHideTimer();
    };
  }, [eager, rootMargin, hideDelayMs, clearHideTimer]);

  return (
    <div ref={rootRef} className={cn(className)}>
      {show ? children : placeholder}
    </div>
  );
}
