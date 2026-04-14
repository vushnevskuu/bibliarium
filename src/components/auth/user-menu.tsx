"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type MeUser = {
  slug: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
};

export function UserMenu({ boardSlug }: { boardSlug: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [user, setUser] = React.useState<MeUser | null | undefined>(undefined);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const j = (await res.json()) as { user: MeUser | null };
        if (!cancelled) setUser(j.user);
      } catch {
        if (!cancelled) setUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/");
    router.refresh();
  };

  if (user === undefined) {
    return (
      <div
        className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted"
        aria-hidden
      />
    );
  }

  if (!user) return null;

  const label = user.displayName?.trim() || user.email || user.slug;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-muted/40 transition-colors hover:border-foreground/20",
          open && "border-foreground/25"
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- OAuth avatars from arbitrary hosts
          <img
            src={user.avatarUrl}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <UserRound className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] cursor-default"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 top-full z-[70] mt-2 w-56 rounded-lg border border-border bg-popover py-1 text-sm shadow-lg"
          >
            <div className="border-b border-border px-3 py-2">
              <p className="truncate font-medium text-foreground">{label}</p>
              <p className="truncate text-xs text-muted-foreground">@{user.slug}</p>
            </div>
            <Link
              href="/board"
              role="menuitem"
              className="block px-3 py-2 text-foreground hover:bg-muted/60"
              onClick={() => setOpen(false)}
            >
              Board
            </Link>
            <Link
              href="/analysis"
              role="menuitem"
              className="block px-3 py-2 text-foreground hover:bg-muted/60"
              onClick={() => setOpen(false)}
            >
              Taste analysis
            </Link>
            <Link
              href={`/u/${boardSlug}/ai-profile`}
              role="menuitem"
              className="block px-3 py-2 text-foreground hover:bg-muted/60"
              onClick={() => setOpen(false)}
            >
              AI profile page
            </Link>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-foreground hover:bg-muted/60"
              onClick={() => void signOut()}
            >
              <LogOut className="h-4 w-4 shrink-0 opacity-70" />
              Sign out
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
