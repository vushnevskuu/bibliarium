"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserMenu } from "@/components/auth/user-menu";
import { TopBar } from "@/components/board/top-bar";

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: unknown };
    if (typeof j.error === "string") return j.error;
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status})`;
}

export function AnalysisShell({
  children,
  boardSlug,
}: {
  children: React.ReactNode;
  boardSlug: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = async (url: string) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (res.status === 401) {
        window.location.href = "/auth/signin?next=/analysis";
        return;
      }
      if (!res.ok) {
        setError(await parseError(res));
        return;
      }
      router.push("/board");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pt-8 text-foreground">
      <TopBar
        onSubmit={onSubmit}
        busy={busy}
        error={error}
        trailing={<UserMenu boardSlug={boardSlug} />}
      />
      {children}
    </div>
  );
}
