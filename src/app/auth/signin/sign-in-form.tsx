"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  createBrowserSupabaseClient,
  createBrowserSupabaseClientWithConfig,
  isBrowserSupabaseConfigured,
} from "@/lib/supabase/client";
import type { SupabasePublicConfig } from "@/lib/supabase/public-config";
import { safeNextPath } from "@/lib/auth/safe-next";
import { cn } from "@/lib/utils";

type Props = { supabasePublic: SupabasePublicConfig | null };

export function SignInForm({ supabasePublic }: Props) {
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const next = safeNextPath(rawNext);
  const errorParam = searchParams.get("error");
  const detailParam = searchParams.get("detail");

  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState<"google" | "email" | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (errorParam === "expired_link") {
      setError("This sign-in link has expired. Request a new one.");
    } else if (errorParam === "auth_callback") {
      setError(
        detailParam
          ? `Could not complete sign-in: ${detailParam}`
          : "Could not complete sign-in. Try again."
      );
    } else if (errorParam === "missing_config") {
      setError(
        "Supabase is not configured. Add env vars in Vercel (or .env locally), then redeploy."
      );
    } else if (errorParam) {
      setError("Something went wrong. Try again.");
    }
  }, [errorParam, detailParam]);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const onGoogle = async () => {
    if (!isBrowserSupabaseConfigured(supabasePublic)) {
      setError(
        "Supabase is not configured. In Vercel → Settings → Environment Variables, add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_URL and SUPABASE_ANON_KEY), then Redeploy."
      );
      return;
    }
    setError(null);
    setMessage(null);
    setBusy("google");
    try {
      const supabase = supabasePublic
        ? createBrowserSupabaseClientWithConfig(supabasePublic)
        : createBrowserSupabaseClient();
      const { error: e } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: { prompt: "consent" },
        },
      });
      if (e) setError(e.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setBusy(null);
    }
  };

  const onMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || busy) return;
    if (!isBrowserSupabaseConfigured(supabasePublic)) {
      setError(
        "Supabase is not configured. In Vercel → Settings → Environment Variables, add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_URL and SUPABASE_ANON_KEY), then Redeploy."
      );
      return;
    }
    setError(null);
    setMessage(null);
    setBusy("email");
    try {
      const supabase = supabasePublic
        ? createBrowserSupabaseClientWithConfig(supabasePublic)
        : createBrowserSupabaseClient();
      const { error: err } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
        },
      });
      if (err) {
        setError(err.message);
        return;
      }
      setMessage(
        "Check your inbox — we sent a sign-in link. It may take a minute."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send email");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      {message ? (
        <div
          className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-foreground"
          role="status"
        >
          {message}
        </div>
      ) : null}

      {error ? (
        <p
          className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void onGoogle()}
        disabled={busy !== null}
        className={cn(
          "flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-background text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
        )}
      >
        {busy === "google" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <span
            className="flex h-6 w-6 items-center justify-center rounded-sm bg-background text-xs font-bold text-foreground ring-1 ring-border"
            aria-hidden
          >
            G
          </span>
        )}
        Continue with Google
      </button>

      <div className="relative py-2 text-center text-xs text-muted-foreground">
        <span className="relative z-10 bg-card px-2">or</span>
        <div className="absolute inset-x-0 top-1/2 border-t border-border" />
      </div>

      <form onSubmit={onMagicLink} className="space-y-3">
        <label className="block text-left">
          <span className="text-xs font-medium text-muted-foreground">
            Email
          </span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            disabled={busy !== null}
            className="mt-1.5 h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none ring-0 placeholder:text-muted-foreground/50 focus:border-foreground/25 disabled:opacity-50"
          />
        </label>
        <button
          type="submit"
          disabled={busy !== null || !email.trim()}
          className="flex h-11 w-full items-center justify-center rounded-md bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy === "email" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Email me a magic link"
          )}
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        No password. You&apos;ll stay signed in on this device until you sign
        out.
      </p>
    </div>
  );
}
