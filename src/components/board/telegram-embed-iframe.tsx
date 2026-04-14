"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const TELEGRAM_EMBED_ORIGIN = "https://t.me";

function parseTelegramWidgetResizeHeight(data: unknown): number | null {
  let parsed: unknown = data;
  if (typeof data === "string") {
    try {
      parsed = JSON.parse(data) as unknown;
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  if (o.event !== "resize" || typeof o.height !== "number") return null;
  if (!Number.isFinite(o.height) || o.height <= 0) return null;
  return Math.min(Math.round(o.height), 8000);
}

const LOADING_MIN_PX = 200;

export function TelegramEmbedIframe({
  src,
  title,
  className,
}: {
  src: string;
  title: string;
  className?: string;
}) {
  const [heightPx, setHeightPx] = React.useState<number | null>(null);

  React.useEffect(() => {
    setHeightPx(null);
  }, [src]);

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== TELEGRAM_EMBED_ORIGIN) return;
      const h = parseTelegramWidgetResizeHeight(event.data);
      if (h) setHeightPx(h);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div
      className={cn(
        /* Без своего фона и без второго overflow — скругление и клип только у карточки, иначе «двойной» угол. */
        "relative w-full min-w-0 bg-transparent",
        className
      )}
    >
      {/*
        Telegram embed lays out ~550px-wide content inside a full-width iframe, which
        reads as an empty strip on the right. Match card bg and cap width to their layout.
      */}
      <div className="mx-auto w-full min-w-0 max-w-[550px]">
        <iframe
          title={title}
          src={src}
          className="block w-full min-w-0 max-w-full rounded-2xl border-0 align-top outline-none ring-0 [transform:translateZ(0)]"
          style={
            heightPx != null
              ? { height: heightPx, maxHeight: "none" }
              : { minHeight: LOADING_MIN_PX }
          }
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
