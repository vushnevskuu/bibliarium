"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { LinkSerialized } from "@/types/link";
import { cn } from "@/lib/utils";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { LinkCard } from "./link-card";
import { EmptyState } from "./empty-state";
import { CardSkeleton } from "./card-skeleton";

/** Measures how many columns fit in the container and updates on resize. */
function useMasonryCols(
  containerRef: React.RefObject<HTMLDivElement>,
  minColWidth = 300,
  gap = 20,
) {
  const [cols, setCols] = React.useState(1);
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const n = Math.max(1, Math.floor((el.offsetWidth + gap) / (minColWidth + gap)));
      setCols(n);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, minColWidth, gap]);
  return cols;
}

const SHUFFLE_WORD = "shuffle";
const SHUFFLE_N = SHUFFLE_WORD.length;
const SHUFFLE_IDENTITY = Array.from({ length: SHUFFLE_N }, (_, i) => i);

/**
 * Animates the letters of "shuffle" like horizontal sliding puzzle tiles.
 * On hover: generates 3 random pair-swaps applied one-by-one every 550ms.
 * On leave: all letters instantly slide back to their home positions.
 */
function useSlideLetters() {
  const [order, setOrder] = React.useState<number[]>(SHUFFLE_IDENTITY);
  const timersRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const stateRef = React.useRef<number[]>(SHUFFLE_IDENTITY);

  const clear = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const onEnter = React.useCallback(() => {
    clear();
    const working = [...stateRef.current];
    // Pre-compute 3 random swaps and their resulting states
    const steps: number[][] = [];
    for (let k = 0; k < 3; k++) {
      const a = Math.floor(Math.random() * SHUFFLE_N);
      let b: number;
      do { b = Math.floor(Math.random() * SHUFFLE_N); } while (b === a);
      [working[a], working[b]] = [working[b], working[a]];
      steps.push([...working]);
    }
    steps.forEach((snapshot, i) => {
      timersRef.current.push(
        setTimeout(() => {
          stateRef.current = snapshot;
          setOrder(snapshot);
        }, (i + 1) * 550)
      );
    });
  }, []);

  const onLeave = React.useCallback(() => {
    clear();
    stateRef.current = SHUFFLE_IDENTITY;
    setOrder(SHUFFLE_IDENTITY);
  }, []);

  React.useEffect(() => () => clear(), []);

  return { order, onEnter, onLeave };
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
  const { order: shuffleOrder, onEnter: shuffleEnter, onLeave: shuffleLeave } = useSlideLetters();
  const gridRef = React.useRef<HTMLDivElement>(null);
  const numCols = useMasonryCols(gridRef);
  const [links, setLinks] = React.useState<LinkSerialized[]>(initialLinks);
  const [busy, setBusy] = React.useState(false);
  const [loadingList, setLoadingList] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [skeletonCount, setSkeletonCount] = React.useState(0);
  const [mixBusy, setMixBusy] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

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

  // Ctrl+V / Cmd+V anywhere on the page — paste URL directly without opening the add form
  const onSubmitRef = React.useRef(onSubmit);
  React.useLayoutEffect(() => { onSubmitRef.current = onSubmit; });
  const busyRef = React.useRef(busy);
  React.useLayoutEffect(() => { busyRef.current = busy; }, [busy]);

  React.useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Skip when user is focused inside any input / textarea / contenteditable
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      ) return;

      if (busyRef.current) return;

      const text = (e.clipboardData?.getData("text") ?? "").trim();
      if (!text) return;

      const hasProto = /^https?:\/\//i.test(text);
      const looksLikeUrl = hasProto || /^([\w-]+\.)+[\w]{2,}/i.test(text);
      if (!looksLikeUrl) return;

      void onSubmitRef.current(hasProto ? text : `https://${text}`);
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

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
    onOpen: () => { /* card click disabled */ },
    onDelete: () => void onDelete(link.id),
    onPatched: (updated: LinkSerialized) => {
      setLinks((prev) =>
        prev.map((l) => (l.id === updated.id ? updated : l))
      );
    },
  });


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

            {/* Right: shuffle */}
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={() => void onMix()}
                onMouseEnter={shuffleEnter}
                onMouseLeave={shuffleLeave}
                disabled={links.length < 2 || mixBusy || loadingList}
                className={cn(
                  "font-mono text-[18px] font-medium leading-snug tracking-tight text-muted-foreground transition-colors hover:text-foreground",
                  "disabled:pointer-events-none disabled:opacity-30"
                )}
              >
                <span className="inline-flex">
                  {shuffleOrder.map((charIdx) => (
                    <motion.span
                      key={charIdx}
                      layout
                      transition={{ type: "spring", stiffness: 90, damping: 18 }}
                    >
                      {SHUFFLE_WORD[charIdx]}
                    </motion.span>
                  ))}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Masonry container — always mounted so ResizeObserver can measure */}
        <div ref={gridRef} className="flex items-start gap-5">
          {(() => {
            // Build flat item list: loading skeletons OR (add-skeleton + cards)
            const items: React.ReactNode[] = loadingList && links.length === 0
              ? Array.from({ length: 6 }, (_, i) => <CardSkeleton key={`ls-${i}`} />)
              : [
                  ...(busy && skeletonCount > 0
                    ? Array.from({ length: skeletonCount }, (_, i) => <CardSkeleton key={`skm-${i}`} />)
                    : []),
                  ...links.map((link) => (
                    <LinkCard key={link.id} {...cardProps(link)} />
                  )),
                ];

            if (items.length === 0) return null;

            // Distribute round-robin across columns
            const columns: React.ReactNode[][] = Array.from({ length: numCols }, () => []);
            items.forEach((item, i) => columns[i % numCols].push(item));

            return columns.map((col, ci) => (
              <div key={ci} className="flex flex-1 flex-col gap-5 min-w-0">
                {col}
              </div>
            ));
          })()}
        </div>

        {/* Empty state — outside masonry so it can be fixed-centered */}
        {!loadingList && links.length === 0 && !busy && (
          <EmptyState onSubmit={onSubmit} busy={busy} error={error} />
        )}
      </main>

    </div>
  );
}
