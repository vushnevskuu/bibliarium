"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { LinkSerialized } from "@/types/link";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/auth/user-menu";
import { TopBar } from "./top-bar";
import { LinkCard } from "./link-card";
import { EmptyState } from "./empty-state";
import { CardSkeleton } from "./card-skeleton";

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
  currentSlug,
}: {
  initialLinks: LinkSerialized[];
  currentSlug: string;
}) {
  const router = useRouter();
  const [links, setLinks] = React.useState<LinkSerialized[]>(initialLinks);
  const [busy, setBusy] = React.useState(false);
  const [loadingList, setLoadingList] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [skeletonCount, setSkeletonCount] = React.useState(0);
  const [mixBusy, setMixBusy] = React.useState(false);

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
    setSkeletonCount(2);

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


  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar
        onSubmit={onSubmit}
        busy={busy}
        error={error}
        trailing={<UserMenu boardSlug={currentSlug} />}
      />

      <main className="min-w-0 px-2 pb-6 pt-8 sm:px-3">
        <div className="mb-8 flex w-full min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-lg font-medium tracking-tight text-muted-foreground sm:text-xl">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 sm:gap-x-3">
            <h1 className="m-0 inline p-0 font-semibold text-foreground">Bibliarium</h1>
            <span className="select-none" aria-hidden>
              •
            </span>
            <span>
              {links.length} card{links.length === 1 ? "" : "s"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void onMix()}
            disabled={links.length < 2 || mixBusy || loadingList}
            title={
              links.length < 2
                ? "Add at least two cards to shuffle"
                : "Shuffle card order"
            }
            className={cn(
              "shrink-0 border-0 bg-transparent p-0 text-right shadow-none outline-none ring-0 transition-colors",
              "underline-offset-4 hover:text-foreground hover:underline",
              "focus-visible:text-foreground focus-visible:underline focus-visible:ring-1 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm",
              "disabled:pointer-events-none disabled:no-underline disabled:opacity-40"
            )}
          >
            shuffle
          </button>
        </div>

        {!loadingList && links.length === 0 ? (
          <EmptyState onSubmit={onSubmit} busy={busy} />
        ) : (
          <div className="columns-[300px] gap-2">
            {loadingList && links.length === 0
              ? Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="mb-2 break-inside-avoid">
                    <CardSkeleton />
                  </div>
                ))
              : links.map((link) => (
                  <div key={link.id} className="mb-2 break-inside-avoid">
                    <LinkCard {...cardProps(link)} />
                  </div>
                ))}
            {busy &&
              Array.from({ length: skeletonCount || 1 }, (_, i) => (
                <div key={`skm-${i}`} className="mb-2 break-inside-avoid">
                  <CardSkeleton />
                </div>
              ))}
          </div>
        )}
      </main>

    </div>
  );
}
