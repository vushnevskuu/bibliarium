"use client";

import * as React from "react";

const IFRAME_HEIGHT = 440;

export function WebPageIframe({ src, title }: { src: string; title: string }) {
  const [status, setStatus] = React.useState<"loading" | "loaded">("loading");

  React.useEffect(() => {
    setStatus("loading");
  }, [src]);

  return (
    <div
      className="relative w-full overflow-hidden bg-muted"
      style={{ height: IFRAME_HEIGHT }}
    >
      {status === "loading" && (
        <div className="skeleton absolute inset-0" />
      )}
      <iframe
        src={src}
        title={title}
        className="block h-full w-full border-0"
        style={{ height: IFRAME_HEIGHT }}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="fullscreen"
        onLoad={() => setStatus("loaded")}
      />
    </div>
  );
}
