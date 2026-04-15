import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  Download,
  FileJson2,
  LayoutGrid,
  ShieldCheck,
} from "lucide-react";
import { faqCopy } from "@/components/landing/landing-json-ld";
import { getSiteUrl } from "@/lib/site-url";

const SIGNIN = "/auth/signin?next=/board";

export function LandingPage() {
  const site = getSiteUrl();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45] dark:opacity-[0.35]"
        aria-hidden
      >
        <div
          className="absolute -left-1/4 top-0 h-[min(70vh,520px)] w-[min(140vw,900px)] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, hsl(var(--foreground) / 0.06), transparent 72%)",
          }}
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.5)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.4)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black_20%,transparent)]"
          aria-hidden
        />
      </div>

      <a
        href="#main-content"
        className="absolute left-[-9999px] top-4 z-[100] rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background focus:left-4 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
      >
        Skip to content
      </a>

      <header className="relative z-10 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="group flex items-center gap-2.5 text-foreground no-underline"
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-sm font-bold tracking-tight shadow-sm transition-colors group-hover:border-foreground/20"
              aria-hidden
            >
              B
            </span>
            <span className="text-sm font-semibold tracking-tight sm:text-base">
              Bibliarium
            </span>
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-2" aria-label="Primary">
            <a
              href="/bibliarium-extension.zip"
              download="bibliarium-extension.zip"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Download className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              <span className="hidden sm:inline">Extension</span>
              <span className="sm:hidden">.zip</span>
            </a>
            <Link
              href="/extension"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              Install guide
            </Link>
            <Link
              href={SIGNIN}
              className="rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Sign in
            </Link>
            <Link
              href={SIGNIN}
              className="hidden rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:inline-flex sm:items-center sm:gap-1.5"
            >
              Get started
              <ArrowRight className="h-4 w-4 opacity-90" aria-hidden />
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content" className="relative z-10">
        <section
          className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20 lg:px-8 lg:pb-28 lg:pt-24"
          aria-labelledby="hero-heading"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Visual taste board
          </p>
          <h1
            id="hero-heading"
            className="mt-5 max-w-[18ch] text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:max-w-none sm:text-5xl lg:text-[3.25rem] lg:leading-[1.06]"
          >
            Curate links like a moodboard. Ship taste to any LLM.
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Drop YouTube, articles, images, and tools onto a fast masonry canvas.
            Every save keeps previews plus a structured profile—topics, mood
            hints, and{" "}
            <span className="font-medium text-foreground/90">
              vector-ready text
            </span>{" "}
            —then roll it up into JSON or Markdown you can paste into ChatGPT,
            Claude, or your own stack.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href={SIGNIN}
              className="inline-flex h-12 min-w-[200px] items-center justify-center gap-2 rounded-lg bg-foreground px-6 text-sm font-semibold text-background shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Start free — email or Google
              <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            </Link>
            <a
              href="/bibliarium-extension.zip"
              download="bibliarium-extension.zip"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card px-5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-foreground/20 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden />
              Download Chrome extension
            </a>
            <Link
              href="/u/demo/ai-profile"
              className="inline-flex h-12 items-center justify-center px-2 text-sm font-medium text-muted-foreground underline-offset-[6px] transition-colors hover:text-foreground hover:underline sm:px-4"
            >
              View sample AI profile (after seed)
            </Link>
          </div>

          <ul className="mt-12 flex flex-wrap gap-x-8 gap-y-3 border-t border-border/80 pt-8 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-foreground/70" aria-hidden />
              Private by default; you choose what to share
            </li>
            <li className="flex items-center gap-2">
              <FileJson2 className="h-4 w-4 shrink-0 text-foreground/70" aria-hidden />
              JSON &amp; Markdown exports
            </li>
            <li className="flex items-center gap-2">
              <Bookmark className="h-4 w-4 shrink-0 text-foreground/70" aria-hidden />
              Magic link + Google OAuth
            </li>
          </ul>
        </section>

        <section
          className="border-t border-border/60 bg-muted/25 py-16 sm:py-20"
          aria-labelledby="value-heading"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2
                id="value-heading"
                className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              >
                Why teams use it
              </h2>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                One calm surface for research, references, and machine-readable
                taste.
              </p>
            </div>

            <ol className="mt-12 grid gap-6 sm:grid-cols-3">
              {[
                {
                  step: "01",
                  title: "Capture",
                  body: "Paste any URL — embeds, OG cards, Telegram, X, images — with guarded server-side fetches.",
                  icon: Bookmark,
                },
                {
                  step: "02",
                  title: "Arrange",
                  body: "Shuffle and sort on a masonry board so visual weight matches how you think, not a flat list.",
                  icon: LayoutGrid,
                },
                {
                  step: "03",
                  title: "Export",
                  body: "Bundle link profiles into a master dossier for LLMs without re-crawling every source.",
                  icon: FileJson2,
                },
              ].map((item) => (
                <li key={item.step}>
                  <article className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-mono text-xs font-medium text-muted-foreground">
                        {item.step}
                      </span>
                      <item.icon
                        className="h-5 w-5 shrink-0 text-foreground/75"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold tracking-tight">
                      {item.title}
                    </h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {item.body}
                    </p>
                  </article>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
          aria-labelledby="faq-heading"
        >
          <h2
            id="faq-heading"
            className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground"
          >
            FAQ
          </h2>
          <p className="mt-3 max-w-xl text-2xl font-semibold tracking-tight text-foreground">
            Straight answers before you sign in.
          </p>
          <dl className="mt-10 divide-y divide-border border-t border-border">
            {faqCopy.map((item) => (
              <div key={item.q} className="grid gap-2 py-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-10">
                <dt className="text-sm font-semibold text-foreground sm:pt-0.5">
                  {item.q}
                </dt>
                <dd className="text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/80 bg-muted/20 py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold text-foreground">Bibliarium</p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Built for curators who want visual boards today and structured
              exports for AI workflows tomorrow.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-muted-foreground">
            <Link href={SIGNIN} className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/extension" className="hover:text-foreground">
              Extension
            </Link>
            <a
              href="/bibliarium-extension.zip"
              download="bibliarium-extension.zip"
              className="hover:text-foreground"
            >
              Extension (.zip)
            </a>
            <Link href="/board" className="hover:text-foreground">
              Board
            </Link>
            <span className="text-muted-foreground/70" aria-hidden>
              ·
            </span>
            <span className="text-muted-foreground/80">{site.replace(/^https?:\/\//, "")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
