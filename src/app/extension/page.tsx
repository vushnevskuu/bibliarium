import type { Metadata } from "next";
import Link from "next/link";
import { getSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Browser extension",
  description:
    "Install the Bibliarium Chrome extension to save tabs and links without opening the app.",
};

export default function ExtensionLandingPage() {
  const base = getSiteUrl();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Bibliarium
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Browser extension
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Save the current page, any link, or an image URL straight into your
          board. Works with the same account as the web app (session from the{" "}
          <Link href="/extension/connect" className="underline underline-offset-4">
            connect page
          </Link>
          ).
        </p>

        <section className="mt-10 space-y-4 rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold">Install (Chrome, unpacked)</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Download{" "}
              <a
                className="font-medium text-foreground underline underline-offset-4"
                href="/bibliarium-extension.zip"
              >
                bibliarium-extension.zip
              </a>{" "}
              (run <code className="rounded bg-muted px-1">npm run extension:zip</code>{" "}
              in the repo if the file is missing).
            </li>
            <li>Unpack the archive to a folder.</li>
            <li>
              Open{" "}
              <code className="rounded bg-muted px-1">chrome://extensions</code>
              , enable Developer mode, click Load unpacked, select the folder.
            </li>
            <li>
              Open extension options → set base URL to{" "}
              <span className="font-mono text-xs text-foreground">{base}</span>{" "}
              (or your production origin).
            </li>
            <li>
              Sign in on the web app, open{" "}
              <Link
                href="/extension/connect"
                className="font-medium text-foreground underline underline-offset-4"
              >
                /extension/connect
              </Link>
              , copy session JSON into extension options.
            </li>
            <li>
              For HTTPS deployments, use &quot;Request HTTPS access&quot; in
              extension settings so the browser allows API calls.
            </li>
          </ol>
        </section>

        <p className="mt-8 text-xs text-muted-foreground">
          Firefox: same codebase is MV3-compatible; use{" "}
          <code className="rounded bg-muted px-1">browser-polyfill</code> when
          you add packaging (see <code className="rounded bg-muted px-1">extension/README.md</code>).
        </p>

        <Link
          href="/"
          className="mt-10 inline-block text-sm font-medium underline underline-offset-4"
        >
          ← Home
        </Link>
      </main>
    </div>
  );
}
