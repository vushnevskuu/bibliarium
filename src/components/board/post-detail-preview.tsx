"use client";

import type { LinkSerialized } from "@/types/link";
import { extractYouTubeId, isYoutubeShortsUrl } from "@/lib/url-parse";
import { cn } from "@/lib/utils";
import { TelegramEmbedIframe } from "@/components/board/telegram-embed-iframe";
import { TwitterEmbedIframe } from "@/components/board/twitter-embed-iframe";
import { TelegramLinkIcon } from "@/components/icons/telegram-link-icon";

function youtubeModalEmbedSrc(link: LinkSerialized): string | null {
  if (link.embedUrl) return link.embedUrl;
  try {
    const id = extractYouTubeId(new URL(link.url));
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

export function PostDetailPreview({
  link,
  twitterSrc,
  telegramSrc,
}: {
  link: LinkSerialized;
  twitterSrc: string | null;
  telegramSrc: string | null;
}) {
  if (link.provider === "youtube") {
    const ytSrc = youtubeModalEmbedSrc(link);
    if (ytSrc) {
      const shorts =
        isYoutubeShortsUrl(link.url) || isYoutubeShortsUrl(link.normalizedUrl);
      return (
        <div
          className={cn(
            "mx-auto w-full overflow-hidden rounded-2xl border border-border bg-black",
            shorts
              ? "aspect-[9/16] max-h-[min(85vh,720px)] max-w-[min(100%,400px)]"
              : "aspect-video"
          )}
        >
          <iframe
            title="YouTube"
            src={ytSrc}
            className="h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      );
    }
  }

  if (telegramSrc) {
    return (
      <TelegramEmbedIframe
        src={telegramSrc}
        title={link.title || "Telegram"}
      />
    );
  }

  if (link.provider === "telegram") {
    const href = link.normalizedUrl || link.url;
    return (
      <div className="bg-muted/20 px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 flex-1 break-all text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            {href}
          </a>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 transition-opacity hover:opacity-80"
            aria-label="Open in Telegram"
          >
            <TelegramLinkIcon />
          </a>
        </div>
      </div>
    );
  }

  if (link.provider === "twitter") {
    if (twitterSrc) {
      return (
        <TwitterEmbedIframe
          src={twitterSrc}
          title="X (Twitter)"
          className="border border-border bg-muted"
        />
      );
    }
    if (link.embedHtml) {
      return (
        <div
          className="rounded-md border border-border bg-muted/30 p-4 text-sm leading-relaxed [&_blockquote]:border-l-2 [&_blockquote]:border-foreground/20 [&_blockquote]:pl-4"
          dangerouslySetInnerHTML={{ __html: link.embedHtml }}
        />
      );
    }
    return (
      <p className="text-sm text-muted-foreground">
        This post can&apos;t be embedded here. Open in a new tab to view.
      </p>
    );
  }

  if (link.provider === "image" && link.imageUrl) {
    return (
      <div className="overflow-hidden rounded-md border border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={link.imageUrl}
          alt=""
          className="max-h-[min(520px,70vh)] w-full object-contain"
        />
      </div>
    );
  }

  return (
    <>
      {link.imageUrl ? (
        <div className="mb-4 overflow-hidden rounded-md border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={link.imageUrl}
            alt=""
            className="max-h-[min(400px,50vh)] w-full object-cover"
          />
        </div>
      ) : null}
      {link.embedHtml ? (
        <div
          className="rounded-md border border-border bg-muted/30 p-4 text-sm leading-relaxed [&_iframe]:max-w-full"
          dangerouslySetInnerHTML={{ __html: link.embedHtml }}
        />
      ) : null}
      {link.description ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {link.description}
        </p>
      ) : null}
      {!link.imageUrl && !link.embedHtml && !link.description ? (
        <p className="text-sm text-muted-foreground">
          Preview isn&apos;t available inline — this site may block embedding.
          Use Open to view in a new tab.
        </p>
      ) : null}
    </>
  );
}
