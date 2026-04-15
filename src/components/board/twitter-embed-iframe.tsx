"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Origins used by X/Twitter `platform.twitter.com/embed/Tweet.html` iframes. */
const TWITTER_EMBED_ORIGINS = new Set([
  "https://platform.twitter.com",
  "https://syndication.twitter.com",
]);

/** Parses `postMessage` payload from the official tweet embed (see twttr.embed JSON-RPC). */
function parseTweetEmbedResizeHeight(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const tw = (data as Record<string, unknown>)["twttr.embed"];
  if (!tw || typeof tw !== "object") return null;
  const obj = tw as Record<string, unknown>;
  if (obj.method !== "twttr.private.resize") return null;
  const params = obj.params;
  if (!Array.isArray(params) || params.length === 0) return null;
  const first = params[0];
  if (!first || typeof first !== "object") return null;
  const h = (first as Record<string, unknown>)["height"];
  if (typeof h !== "number" || !Number.isFinite(h) || h <= 0) return null;
  return Math.min(Math.round(h), 8000);
}

const LOADING_MIN_PX = 40;

function resizeMessageTargetsIframe(
  iframe: HTMLIFrameElement | null,
  source: MessageEventSource | null,
): boolean {
  const root = iframe?.contentWindow;
  if (!root || !source) return false;
  if (source === root) return true;
  if (typeof source !== "object" || !("parent" in source)) return false;
  let w: Window | null = source as Window;
  for (let depth = 0; depth < 16 && w; depth++) {
    if (w === root) return true;
    try {
      const parentWin: Window | null = w.parent;
      if (!parentWin || parentWin === w) break;
      w = parentWin;
    } catch {
      break;
    }
  }
  return false;
}

export function TwitterEmbedIframe({
  src,
  title,
  className,
}: {
  src: string;
  title: string;
  /** Extra classes on the outer clip wrapper (border, theme bg, etc.). */
  className?: string;
}) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [heightPx, setHeightPx] = React.useState<number | null>(null);

  React.useEffect(() => {
    setHeightPx(null);
  }, [src]);

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!TWITTER_EMBED_ORIGINS.has(event.origin)) return;
      if (!resizeMessageTargetsIframe(iframeRef.current, event.source)) return;
      const h = parseTweetEmbedResizeHeight(event.data);
      if (h) setHeightPx(h);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const h = heightPx ?? LOADING_MIN_PX;

  return (
    <div
      className={cn("relative w-full min-w-0 bg-transparent transition-[height] duration-150", className)}
      style={{ height: h }}
    >
      <iframe
        ref={iframeRef}
        title={title}
        src={src}
        className="pointer-events-auto block w-full min-w-0 max-w-full border-0 align-top bg-transparent"
        style={{ height: h, maxHeight: "none" }}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="fullscreen"
      />
    </div>
  );
}
