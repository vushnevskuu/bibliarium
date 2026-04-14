"use client";

import * as React from "react";
import { ExternalLink, Maximize2, Minimize2, X } from "lucide-react";
import { useTheme } from "next-themes";
import type { LinkSerialized } from "@/types/link";
import { resolveTelegramEmbedUrl, resolveTwitterEmbedSrc } from "@/lib/url-parse";
import { cn } from "@/lib/utils";
import { PostDetailPreview } from "@/components/board/post-detail-preview";

export function PostDetailPanel({
  link,
  onClose,
  readOnly = false,
  onPatched,
}: {
  link: LinkSerialized;
  onClose: () => void;
  readOnly?: boolean;
  onPatched?: (link: LinkSerialized) => void;
}) {
  const { resolvedTheme } = useTheme();
  const [expanded, setExpanded] = React.useState(false);
  const [publicBusy, setPublicBusy] = React.useState(false);

  const togglePublic = async () => {
    if (readOnly || !onPatched) return;
    setPublicBusy(true);
    try {
      const res = await fetch(`/api/links/${link.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !link.isPublic }),
      });
      if (res.status === 401) {
        window.location.href = "/auth/signin?next=/board";
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { link?: LinkSerialized };
      if (data.link) onPatched(data.link);
    } finally {
      setPublicBusy(false);
    }
  };

  const theme = resolvedTheme === "dark" ? "dark" : "light";
  const twitterSrc = resolveTwitterEmbedSrc(link.url, link.embedHtml, theme);
  const telegramSrc = resolveTelegramEmbedUrl(link, theme === "dark");

  const title =
    link.title?.trim() ||
    link.siteName?.trim() ||
    link.domain ||
    "Saved link";

  return (
    <div
      className={cn(
        "flex max-h-[min(92vh,880px)] w-[min(92vw,720px)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg transition-[max-width,max-height] duration-200 ease-out",
        expanded &&
          "max-h-[min(96vh,940px)] w-[min(98vw,1320px)] shadow-xl",
        telegramSrc ? "overflow-clip" : ""
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2
          id="post-detail-title"
          className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground"
          title={title}
        >
          {title}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-foreground transition-colors hover:border-foreground/20"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Original</span>
          </a>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground"
            aria-expanded={expanded}
            aria-label={expanded ? "Свернуть окно" : "Расширить окно"}
            title={expanded ? "Свернуть" : "Расширить"}
          >
            {expanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 scrollbar-none",
          expanded
            ? "max-h-[calc(min(96vh,940px)-64px)]"
            : "max-h-[calc(min(92vh,880px)-64px)]"
        )}
      >
        {link.note ? (
          <div className="mb-4 rounded-md border border-border bg-muted/40 px-3.5 py-2.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Your note
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {link.note}
            </p>
          </div>
        ) : null}

        {!readOnly && onPatched ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">
                Public card link
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Anyone with the URL can open this card when enabled.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={link.isPublic}
              disabled={publicBusy}
              onClick={() => void togglePublic()}
              className={cn(
                "relative h-7 w-12 shrink-0 rounded-full border transition-colors",
                link.isPublic
                  ? "border-foreground/30 bg-foreground"
                  : "border-border bg-background"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-transform",
                  link.isPublic ? "translate-x-6" : "translate-x-0.5"
                )}
              />
            </button>
          </div>
        ) : null}

        <PostDetailPreview
          link={link}
          twitterSrc={twitterSrc}
          telegramSrc={telegramSrc}
        />

        {link.aiProfile ? (
          <div className="mt-6 rounded-md border border-border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              AI-readable profile
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              {typeof link.aiProfile.summary === "string"
                ? link.aiProfile.summary
                : ""}
            </p>
            {Array.isArray(link.aiProfile.topics) &&
            link.aiProfile.topics.length ? (
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Topics: </span>
                {link.aiProfile.topics.join(", ")}
              </p>
            ) : null}
            {Array.isArray(link.aiProfile.mood_tone) &&
            link.aiProfile.mood_tone.length ? (
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Mood: </span>
                {link.aiProfile.mood_tone.join(", ")}
              </p>
            ) : null}
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-foreground">
                vector_ready_text (for embeddings)
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-background p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                {typeof link.aiProfile.vector_ready_text === "string"
                  ? link.aiProfile.vector_ready_text
                  : ""}
              </pre>
            </details>
          </div>
        ) : null}
      </div>
    </div>
  );
}
