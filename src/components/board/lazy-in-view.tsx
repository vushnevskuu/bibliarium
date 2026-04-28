"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Монтирует тяжёлое дерево (iframe и т.п.) только когда блок близко к viewport.
 * Разметка/геометрия задаётся через одинаковый placeholder — без скачков CLS.
 */
export function LazyInView({
  className,
  placeholder,
  children,
  rootMargin = "300px 0px 400px 0px",
  /** Сразу монтировать без ожидания (например уже в зоне первого экрана) */
  eager = false,
}: {
  className?: string;
  placeholder: React.ReactNode;
  children: React.ReactNode;
  rootMargin?: string;
  eager?: boolean;
}) {
  const [show, setShow] = React.useState(eager);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (show) return;
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
        }
      },
      { root: null, rootMargin, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [show, rootMargin]);

  return (
    <div ref={rootRef} className={cn(className)}>
      {show ? children : placeholder}
    </div>
  );
}
