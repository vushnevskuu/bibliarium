"use client";

import * as React from "react";

// Instagram embed pages don't expose reliable postMessage resize events,
// so we use a fixed height matching the standard embed widget dimensions.
const EMBED_HEIGHT = 560;

export function InstagramEmbedIframe({ src, title }: { src: string; title: string }) {
  const [loaded, setLoaded] = React.useState(false);

  return (
    <div
      className="relative w-full overflow-hidden bg-muted"
      style={{ height: EMBED_HEIGHT }}
    >
      {!loaded && <div className="skeleton absolute inset-0" />}
      <iframe
        src={src}
        title={title}
        className="block h-full w-full border-0"
        style={{ height: EMBED_HEIGHT }}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        scrolling="no"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
