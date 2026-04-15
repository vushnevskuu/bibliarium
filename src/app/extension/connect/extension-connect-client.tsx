"use client";

import * as React from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function ExtensionConnectClient() {
  const [sessionJson, setSessionJson] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data, error: e } = await supabase.auth.getSession();
        if (cancelled) return;
        if (e || !data.session) {
          setError("You are not signed in.");
          setSessionJson(null);
          return;
        }
        const s = data.session;
        setSessionJson(
          JSON.stringify(
            {
              access_token: s.access_token,
              refresh_token: s.refresh_token,
              expires_at: s.expires_at,
            },
            null,
            2
          )
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not read session");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const copy = async () => {
    if (!sessionJson) return;
    try {
      await navigator.clipboard.writeText(sessionJson);
    } catch {
      setError("Clipboard blocked — select and copy manually.");
    }
  };

  if (busy) {
    return (
      <p className="text-sm text-muted-foreground">Loading session…</p>
    );
  }

  if (error && !sessionJson) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{error}</p>
        <Link
          href="/auth/signin?next=/extension/connect"
          className="inline-flex rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Copy the JSON below into the extension&apos;s <strong>options</strong>{" "}
        page (Session field), then click Save. Keep this tab private — it
        contains your refresh token.
      </p>
      <button
        type="button"
        onClick={() => void copy()}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
      >
        Copy session JSON
      </button>
      {sessionJson ? (
        <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-muted/30 p-4 text-left text-xs leading-relaxed">
          {sessionJson}
        </pre>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Tokens rotate; if the extension returns 401, paste a fresh JSON from
        this page again.
      </p>
    </div>
  );
}
