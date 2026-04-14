"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function AiProfilePublicToggle({
  initial,
}: {
  initial: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const toggle = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiProfilePublic: !value }),
      });
      if (!res.ok) {
        setError("Could not update visibility.");
        return;
      }
      setValue((v) => !v);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 rounded-lg border border-border bg-muted/20 px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            Public AI profile page
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            When off, only you can open{" "}
            <code className="rounded bg-muted px-1">/u/…/ai-profile</code> and
            taste export URLs. Turn on to share with others or LLM tools.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={value}
            disabled={busy}
            onClick={() => void toggle()}
            className={cn(
              "relative h-7 w-12 rounded-full border transition-colors",
              value
                ? "border-foreground/30 bg-foreground"
                : "border-border bg-background"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-transform",
                value ? "translate-x-6" : "translate-x-0.5"
              )}
            />
          </button>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : null}
        </div>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
