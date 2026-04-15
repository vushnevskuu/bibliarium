import { Suspense } from "react";
import Link from "next/link";
import { resolveSupabaseFromProcessEnv } from "@/lib/supabase/resolve-env";
import { SignInForm } from "./sign-in-form";

export const dynamic = "force-dynamic";

function FormFallback() {
  return (
    <div className="h-48 animate-pulse rounded-lg bg-muted/40" aria-hidden />
  );
}

export default function SignInPage() {
  const supabasePublic = resolveSupabaseFromProcessEnv();
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex justify-end px-4 py-4 sm:px-8">
        <Link
          href="/"
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Back
        </Link>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-20">
        <div className="w-full max-w-[400px] rounded-2xl border border-border bg-card p-8 shadow-sm">
          <h1 className="text-center text-xl font-semibold tracking-tight">
            Sign in to Bibliarium
          </h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Save links, run taste analysis, and export for LLMs.
          </p>
          <div className="mt-8">
            <Suspense fallback={<FormFallback />}>
              <SignInForm supabasePublic={supabasePublic} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
