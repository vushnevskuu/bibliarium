import type { Metadata } from "next";
import Link from "next/link";
import { ExtensionConnectClient } from "./extension-connect-client";

export const metadata: Metadata = {
  title: "Connect extension",
  robots: { index: false, follow: false },
};

export default function ExtensionConnectPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Connect the extension
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          After signing in to Bibliarium in this browser, copy the session for
          the extension.
        </p>
        <div className="mt-8">
          <ExtensionConnectClient />
        </div>
        <Link
          href="/extension"
          className="mt-10 inline-block text-sm underline underline-offset-4"
        >
          ← Extension install guide
        </Link>
      </main>
    </div>
  );
}
