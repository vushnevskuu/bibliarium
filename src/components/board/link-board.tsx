"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Plus, X } from "lucide-react";
import type { LinkSerialized } from "@/types/link";
import { cn } from "@/lib/utils";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { LinkCard } from "./link-card";
import { EmptyState } from "./empty-state";
import { CardSkeleton } from "./card-skeleton";

const SCRAMBLE_CHARS = "abcdefghijklmnopqrstuvwxyz";

function useTextScramble(text: string, duration = 650) {
  const [display, setDisplay] = React.useState(text);
  const rafRef = React.useRef<number | null>(null);

  const trigger = React.useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const next = text
        .split("")
        .map((ch, i) => {
          const threshold = (i + 1) / text.length;
          if (t >= threshold) return ch;
          return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
        })
        .join("");
      setDisplay(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(text);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [text, duration]);

  React.useEffect(
    () => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); },
    []
  );

  return { display, trigger };
}

async function parseError(res: Response): Promise<string> {
  if (res.status === 404) {
    return "API не найден (404). Остановите dev-сервер, в корне проекта выполните: rm -rf .next && npm run dev";
  }
  try {
    const j = (await res.json()) as { error?: unknown };
    if (typeof j.error === "string") return j.error;
    if (j.error && typeof j.error === "object")
      return JSON.stringify(j.error);
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status})`;
}


function shuffleInPlace<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function LinkBoard({
  initialLinks,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  currentSlug: _currentSlug,
  currentEmail,
}: {
  initialLinks: LinkSerialized[];
  currentSlug?: string;
  currentEmail?: string | null;
}) {
  const router = useRouter();
  const { display: shuffleLabel, trigger: triggerScramble } = useTextScramble("shuffle");
  const [links, setLinks] = React.useState<LinkSerialized[]>(initialLinks);
  const [busy, setBusy] = React.useState(false);
  const [loadingList, setLoadingList] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [skeletonCount, setSkeletonCount] = React.useState(0);
  const [mixBusy, setMixBusy] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [urlValue, setUrlValue] = React.useState("");
  const [menuOpen, setMenuOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const refreshLinks = React.useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/links");
      if (res.status === 401) {
        window.location.href = "/auth/signin?next=/board";
        return;
      }
      if (!res.ok) throw new Error(await parseError(res));
      const data = (await res.json()) as { links: LinkSerialized[] };
      setLinks(data.links);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load links");
    } finally {
      setLoadingList(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshLinks();
  }, [refreshLinks]);

  const onMix = React.useCallback(async () => {
    if (links.length < 2 || mixBusy) return;
    const shuffled = shuffleInPlace(links);
    setLinks(shuffled);
    setMixBusy(true);
    try {
      const res = await fetch("/api/links/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: shuffled.map((l) => l.id) }),
      });
      if (res.status === 401) {
        window.location.href = "/auth/signin?next=/board";
        return;
      }
      if (!res.ok) void refreshLinks();
    } finally {
      setMixBusy(false);
    }
  }, [links, mixBusy, refreshLinks]);

  const onSubmit = async (url: string) => {
    setError(null);
    setBusy(true);
    setSkeletonCount(1);

    const postLink = () =>
      fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          collectionId: null,
        }),
      });

    try {
      let res: Response;
      try {
        res = await postLink();
      } catch {
        await new Promise((r) => setTimeout(r, 600));
        res = await postLink();
      }

      const data = (await res.json()) as {
        error?: string;
        link?: LinkSerialized;
        code?: string;
      };

      if (res.status === 409 && data.link) {
        setError("This URL is already on your board.");
        setLinks((prev) => {
          if (prev.some((x) => x.id === data.link!.id)) return prev;
          return [data.link!, ...prev];
        });
        return;
      }

      if (res.status === 401) {
        window.location.href = "/auth/signin?next=/board";
        return;
      }
      if (!res.ok) {
        setError(data.error || (await parseError(res)));
        return;
      }

      if (data.link) {
        setLinks((prev) => {
          if (prev.some((x) => x.normalizedUrl === data.link!.normalizedUrl)) {
            return prev.map((x) =>
              x.normalizedUrl === data.link!.normalizedUrl ? data.link! : x
            );
          }
          return [data.link!, ...prev];
        });
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Something went wrong";
      setError(
        raw === "Failed to fetch"
          ? "Не удалось связаться с сервером. Запусти `npm run dev` и открой http://127.0.0.1:3333 (порт зафиксирован). После сохранения файлов Next иногда рвёт долгий запрос — попробуй добавить ссылку ещё раз."
          : raw
      );
    } finally {
      setBusy(false);
      setSkeletonCount(0);
    }
  };

  const onDelete = async (id: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
    try {
      const res = await fetch(`/api/links/${id}`, { method: "DELETE" });
      if (!res.ok) {
        void refreshLinks();
      }
    } catch {
      void refreshLinks();
    }
  };

  const cardProps = (link: LinkSerialized) => ({
    link,
    onOpen: () => router.push(`/l/${link.id}`),
    onDelete: () => void onDelete(link.id),
    onPatched: (updated: LinkSerialized) => {
      setLinks((prev) =>
        prev.map((l) => (l.id === updated.id ? updated : l))
      );
    },
  });


  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let v = urlValue.trim();
    if (!v || busy) return;
    if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
    onSubmit(v);
    setUrlValue("");
    setAddOpen(false);
  };

  const openAdd = () => {
    setAddOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const closeAdd = () => {
    setAddOpen(false);
    setUrlValue("");
  };

  const signOut = async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="min-w-0 px-10 pb-6 pt-8">
        {/* Header */}
        <div className="mb-8 min-w-0">
          <div className="flex w-full min-w-0 items-center justify-between gap-3">
            {/* Left: title • count • email */}
            <div className="flex min-w-0 items-center gap-x-2 text-[18px] font-medium leading-snug tracking-tight text-muted-foreground sm:gap-x-3">
              <h1 className="m-0 inline p-0 text-[18px] font-semibold leading-snug tracking-tight text-foreground">
                Bibliarium
              </h1>
              <span className="select-none" aria-hidden>
                •
              </span>
              <span>{links.length} card{links.length === 1 ? "" : "s"}</span>
              {currentEmail ? (
                <>
                  <span className="select-none" aria-hidden>
                    •
                  </span>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMenuOpen((o) => !o)}
                      className="max-w-[min(100%,280px)] truncate border-0 bg-transparent p-0 text-left text-[18px] font-medium leading-snug tracking-tight text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {currentEmail}
                    </button>
                    <AnimatePresence>
                      {menuOpen && (
                        <>
                          <button
                            type="button"
                            className="fixed inset-0 z-[60] cursor-default"
                            onClick={() => setMenuOpen(false)}
                            aria-label="Close menu"
                          />
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.12 }}
                            className="absolute left-0 top-full z-[70] mt-1.5 w-40 rounded-lg border border-border bg-popover py-1 text-sm shadow-lg"
                          >
                            <button
                              type="button"
                              onClick={() => void signOut()}
                              className="w-full px-3 py-2 text-left text-foreground hover:bg-muted/60"
                            >
                              Sign out
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              ) : null}
            </div>

            {/* Right: + button and shuffle */}
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={() => void onMix()}
                onMouseEnter={triggerScramble}
                disabled={links.length < 2 || mixBusy || loadingList}
                className={cn(
                  "font-mono text-[18px] font-medium leading-snug tracking-tight text-muted-foreground transition-colors hover:text-foreground",
                  "disabled:pointer-events-none disabled:opacity-30"
                )}
              >
                {shuffleLabel}
              </button>
              <button
                type="button"
                onClick={addOpen ? closeAdd : openAdd}
                disabled={busy}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border border-border transition-colors",
                  addOpen
                    ? "bg-foreground text-background hover:opacity-80"
                    : "bg-background text-foreground hover:border-foreground/40"
                )}
                aria-label={addOpen ? "Cancel" : "Add link"}
              >
                {addOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Expandable URL input */}
          <AnimatePresence>
            {addOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <form onSubmit={handleAddSubmit} className="flex gap-2 pt-3">
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="url"
                    placeholder="Paste any URL — YouTube, X, article…"
                    value={urlValue}
                    onChange={(e) => setUrlValue(e.target.value)}
                    disabled={busy}
                    className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-foreground/25 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!urlValue.trim() || busy}
                    className="flex h-9 shrink-0 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-30"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                  </button>
                </form>
                {error && (
                  <p className="mt-1.5 text-xs text-destructive">{error}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Initial loading */}
        {loadingList && links.length === 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] items-start gap-5">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i}><CardSkeleton /></div>
            ))}
          </div>
        )}

        {/* Empty state — shown when not loading and no links yet, including while first link is being added */}
        {!loadingList && links.length === 0 && (
          <EmptyState onSubmit={onSubmit} busy={busy} error={error} />
        )}

        {/* Grid — shown as soon as there is at least one link */}
        {links.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] items-start gap-5">
            {busy && skeletonCount > 0
              ? Array.from({ length: skeletonCount }, (_, i) => (
                  <div key={`skm-${i}`}><CardSkeleton /></div>
                ))
              : null}
            {links.map((link) => (
              <div key={link.id}>
                <LinkCard {...cardProps(link)} />
              </div>
            ))}
          </div>
        )}
      </main>

    </div>
  );
}
