"use client";

/** Без Framer — лишний layout/paint во время добавления карточек и скролла. */
export function CardSkeleton() {
  return (
    <div className="break-inside-avoid overflow-hidden rounded-2xl border border-border bg-card">
      <div className="skeleton aspect-video w-full rounded-none" />
    </div>
  );
}
