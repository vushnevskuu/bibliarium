"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  ExternalLink,
  Link2,
  StickyNote,
  Trash2,
} from "lucide-react";
import { useTheme } from "next-themes";
import type { LinkSerialized } from "@/types/link";
import { cn } from "@/lib/utils";
import {
  extractYouTubeId,
  isYoutubeShortsUrl,
  resolveTelegramEmbedUrl,
  resolveTwitterEmbedSrc,
} from "@/lib/url-parse";
import { TelegramEmbedIframe } from "@/components/board/telegram-embed-iframe";
import { TwitterEmbedIframe } from "@/components/board/twitter-embed-iframe";
import { InstagramEmbedIframe } from "@/components/board/instagram-embed-iframe";
import { WebPageIframe } from "@/components/board/web-page-iframe";
import { TelegramLinkIcon } from "@/components/icons/telegram-link-icon";

function showBoardLinkMetaStrip(
  link: LinkSerialized,
  isTelegramEmbed: boolean,
): boolean {
  if (isTelegramEmbed) return false;
  if (link.provider === "youtube") return false;
  if (link.provider === "twitter") return false;
  if (link.provider === "telegram") return false;
  // Don't show strip when we're showing a live iframe — the page speaks for itself
  if ((link.provider === "web" || link.provider === "article") && link.embedUrl) return false;
  if (link.provider === "instagram" && link.embedUrl) return false;
  if (link.provider === "pinterest-brand") return false;
  return true;
}

function BoardLinkMetaStrip({
  link,
  onTitleSave,
}: {
  link: LinkSerialized;
  onTitleSave?: (title: string) => Promise<void>;
}) {
  const primary = (link.title?.trim() || link.domain).trim() || "Link";
  const site = link.siteName?.trim();
  const siteLine =
    site && site.toLowerCase() !== link.domain.toLowerCase()
      ? `${site} · ${link.domain}`
      : link.domain;
  const showDescription =
    (link.provider === "web" || link.provider === "article") &&
    Boolean(link.description?.trim());

  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(primary);
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDraft(primary);
    setEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const commit = async () => {
    const value = draft.trim();
    if (!value || value === primary) { setEditing(false); return; }
    setSaving(true);
    try {
      await onTitleSave?.(value);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); void commit(); }
    if (e.key === "Escape") { setEditing(false); }
    e.stopPropagation();
  };

  return (
    <div className="border-t border-border bg-muted/25 px-3 py-2.5 text-left">
      <div className="flex gap-2.5">
        {link.faviconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote favicon URLs
          <img
            src={link.faviconUrl}
            alt=""
            className="mt-0.5 h-4 w-4 shrink-0 rounded-sm opacity-90"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void commit()}
              onKeyDown={onKeyDown}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              disabled={saving}
              className="w-full rounded border border-border bg-background px-1.5 py-0.5 text-sm font-medium leading-snug text-foreground outline-none focus:border-foreground/30 disabled:opacity-60"
            />
          ) : (
            <p
              className="line-clamp-2 cursor-text text-sm font-medium leading-snug text-foreground"
              title="Double-click to edit title"
              onDoubleClick={startEdit}
            >
              {primary}
            </p>
          )}
          <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">
            {siteLine}
          </p>
          {showDescription && link.description ? (
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/90">
              {link.description.trim()}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function youtubeIframeSrc(link: LinkSerialized): string | null {
  if (link.embedUrl) return link.embedUrl;
  try {
    const id = extractYouTubeId(new URL(link.url));
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

function youtubePoster(embedUrl: string | null, pageUrl: string, fallback: string | null) {
  const fromEmbed = embedUrl?.match(/embed\/([^?&]+)/)?.[1];
  if (fromEmbed) return `https://i.ytimg.com/vi/${fromEmbed}/hqdefault.jpg`;
  try {
    const id = extractYouTubeId(new URL(pageUrl));
    if (id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  } catch {
    /* ignore */
  }
  return fallback;
}

function Media({
  link,
  telegramSrc,
}: {
  link: LinkSerialized;
  telegramSrc: string | null;
}) {
  const { resolvedTheme } = useTheme();

  if (link.provider === "youtube") {
    const shorts =
      isYoutubeShortsUrl(link.url) || isYoutubeShortsUrl(link.normalizedUrl);
    const iframeSrc = youtubeIframeSrc(link);
    if (iframeSrc) {
      return (
        <div
          className={cn(
            "relative w-full overflow-hidden bg-black",
            shorts ? "aspect-[9/16]" : "aspect-video"
          )}
        >
          <iframe
            title={link.title || "YouTube video"}
            src={iframeSrc}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      );
    }
    const poster = youtubePoster(link.embedUrl, link.url, link.imageUrl);
    return (
      <div
        className={cn(
          "relative flex w-full items-center justify-center overflow-hidden bg-zinc-900",
          shorts ? "aspect-[9/16]" : "aspect-video"
        )}
      >
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote user URLs
          <img
            src={poster}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
    );
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
            className="min-w-0 flex-1 break-all text-sm font-medium leading-snug text-primary underline-offset-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {href}
          </a>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 transition-opacity hover:opacity-80"
            aria-label="Открыть в Telegram"
            onClick={(e) => e.stopPropagation()}
          >
            <TelegramLinkIcon />
          </a>
        </div>
      </div>
    );
  }

  if (link.provider === "twitter") {
    const theme = resolvedTheme === "dark" ? "dark" : "light";
    const iframeSrc = resolveTwitterEmbedSrc(
      link.url,
      link.embedHtml,
      theme
    );
    if (iframeSrc) {
      return (
        <TwitterEmbedIframe
          src={iframeSrc}
          title={link.title || "Post on X"}
        />
      );
    }
    return (
      <div
        className="relative flex min-h-[140px] flex-col justify-end overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-800/80 p-3"
        style={{
          backgroundImage: link.imageUrl
            ? `linear-gradient(to top, rgba(0,0,0,.75), transparent 55%), url(${link.imageUrl})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {!link.imageUrl ? (
          <div className="absolute right-3 top-3 rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/90">
            X
          </div>
        ) : null}
      </div>
    );
  }

  // Pinterest non-pin pages — branded card (iframe blocked by SAMEORIGIN)
  if (link.provider === "pinterest-brand") {
    return (
      <div
        className="relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 overflow-hidden"
        style={{ background: "linear-gradient(145deg, #E60023 0%, #ad081b 100%)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://s.pinimg.com/webapp/logo_transparent_144x144-3da7a67b.png"
          alt="Pinterest"
          className="h-16 w-16 drop-shadow-lg"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
        <span className="text-sm font-semibold tracking-tight text-white/90">
          {link.title || "Pinterest"}
        </span>
      </div>
    );
  }

  if (link.provider === "instagram" && link.embedUrl) {
    return (
      <InstagramEmbedIframe
        src={link.embedUrl}
        title={link.title || "Post on Instagram"}
      />
    );
  }

  // Web / article: live iframe if server confirmed embedding is allowed
  if ((link.provider === "web" || link.provider === "article") && link.embedUrl) {
    return (
      <WebPageIframe
        src={link.embedUrl}
        title={link.title || link.domain}
      />
    );
  }

  if (link.provider === "image" && link.imageUrl) {
    return (
      <div className="relative w-full overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={link.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="max-h-[320px] w-full object-cover"
        />
      </div>
    );
  }

  // OG image — natural aspect ratio, capped at max-height so portrait/square images show in full
  if (link.imageUrl) {
    return (
      <div className="relative w-full overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={link.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-auto max-h-[520px] w-full object-contain"
        />
      </div>
    );
  }

  // No image and no iframe — large favicon placeholder
  return (
    <div className="flex aspect-[16/10] w-full flex-col items-center justify-center bg-muted/30">
      {link.faviconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={link.faviconUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-14 w-14 rounded-xl object-contain"
        />
      ) : (
        <Link2 className="h-10 w-10 text-muted-foreground/25" strokeWidth={1} aria-hidden />
      )}
    </div>
  );
}

function NoteEditorDialog({
  open,
  initialText,
  onClose,
  onSave,
}: {
  open: boolean;
  initialText: string;
  onClose: () => void;
  onSave: (text: string) => Promise<void>;
}) {
  const [text, setText] = React.useState(initialText);
  const [busy, setBusy] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    if (open) {
      setText(initialText);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [open, initialText]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const runSave = async (value: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await onSave(value);
      // Откладываем размонтирование, иначе клик по фону может «долететь» до карточки.
      window.setTimeout(() => onClose(), 0);
    } catch {
      /* stay open */
    } finally {
      setBusy(false);
    }
  };

  if (!mounted || typeof document === "undefined" || !open) return null;

  const curl = 36;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Save note"
        className="fixed inset-0 z-[499] bg-foreground/15"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void runSave(text);
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Note"
        className="fixed left-1/2 top-1/2 z-[500] w-[min(88vw,288px)] -translate-x-1/2 -translate-y-1/2"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-square w-full">
          <div
            className="absolute inset-0 flex flex-col border border-border bg-card p-4"
            style={{
              clipPath: `polygon(0 0, 100% 0, 100% calc(100% - ${curl}px), calc(100% - ${curl}px) 100%, 0 100%)`,
            }}
          >
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void runSave(text);
                }
              }}
              maxLength={2000}
              disabled={busy}
              className="sticky-note-lines min-h-0 w-full flex-1 resize-none border-0 bg-transparent px-0.5 py-0.5 font-sans text-base leading-[26px] text-foreground outline-none focus:ring-0 disabled:opacity-50 sm:text-[15px] sm:leading-[26px]"
            />
          </div>
          <div
            className="pointer-events-none absolute bottom-0 right-0 z-[1] bg-muted"
            style={{
              width: curl,
              height: curl,
              clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
            }}
            aria-hidden
          />
        </div>
      </div>
    </>,
    document.body
  );
}

export function LinkCard({
  link,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onOpen: _onOpen,
  onDelete,
  onPatched,
  onNoteEditorClose,
  readOnly = false,
}: {
  link: LinkSerialized;
  onOpen: () => void;
  onDelete: () => void;
  onPatched?: (link: LinkSerialized) => void;
  onNoteEditorClose?: () => void;
  readOnly?: boolean;
}) {
  const [noteOpen, setNoteOpen] = React.useState(false);

  const closeNoteEditor = React.useCallback(() => {
    setNoteOpen(false);
    onNoteEditorClose?.();
  }, [onNoteEditorClose]);

  const { resolvedTheme } = useTheme();
  const telegramSrc = resolveTelegramEmbedUrl(
    link,
    resolvedTheme === "dark"
  );
  const isTelegramEmbed = Boolean(telegramSrc);

  const saveNote = async (raw: string) => {
    const trimmed = raw.trim();
    const res = await fetch(`/api/links/${link.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: trimmed === "" ? null : trimmed }),
    });
    if (!res.ok) throw new Error("Could not save note");
    const data = (await res.json()) as { link: LinkSerialized };
    onPatched?.(data.link);
  };

  return (
    <article className="group w-full min-w-0">
      <div
        className={cn(
          "relative rounded-2xl border border-border bg-card overflow-clip",
          isTelegramEmbed && "[backface-visibility:hidden]"
        )}
      >
        {!readOnly && <div
          className="pointer-events-none absolute right-1 top-1 z-20 flex gap-0 rounded-md border border-border bg-background p-0.5 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
        >
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setNoteOpen(true);
            }}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted",
              link.note
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-label={link.note ? "Edit your note" : "Add a note"}
          >
            <StickyNote
              className={cn("h-4 w-4", link.note && "fill-foreground/10")}
              strokeWidth={2}
            />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="Remove card"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>}

        {!readOnly && (
          <NoteEditorDialog
            open={noteOpen}
            initialText={link.note ?? ""}
            onClose={closeNoteEditor}
            onSave={saveNote}
          />
        )}

        <Media link={link} telegramSrc={telegramSrc} />
        {showBoardLinkMetaStrip(link, isTelegramEmbed) ? (
          <BoardLinkMetaStrip
            link={link}
            onTitleSave={readOnly ? undefined : async (title) => {
              const res = await fetch(`/api/links/${link.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title }),
              });
              if (!res.ok) throw new Error("Could not save title");
              const data = (await res.json()) as { link: LinkSerialized };
              onPatched?.(data.link);
            }}
          />
        ) : null}

        {link.note ? (
          <div
            className="pointer-events-none absolute bottom-1 left-1 right-1 z-10 rounded-md border border-border bg-background p-2 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Your note
              </p>
              <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-foreground">
                {link.note}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
