import Link from "next/link";
import type { TasteExportJson } from "@/lib/ai-taste/export-payload";
import { AiProfilePublicToggle } from "@/components/analysis/ai-profile-public-toggle";

export function AnalysisView({
  data,
  exportSlug,
  aiProfilePublic,
}: {
  data: TasteExportJson | null;
  exportSlug: string;
  aiProfilePublic: boolean;
}) {
  if (!data) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-sm text-muted-foreground">
          No taste profile yet. Add links on the board first.
        </p>
        <Link
          href="/board"
          className="mt-4 inline-block text-sm font-medium text-foreground underline underline-offset-4"
        >
          Back to board
        </Link>
        <AiProfilePublicToggle initial={aiProfilePublic} />
      </main>
    );
  }

  const { user_profile, aggregate_stats, clusters, saved_items } = data;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:max-w-4xl">
      <header className="mb-10 border-b border-border pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Taste analysis
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Heuristic aggregate from saved link profiles (MVP — swap in LLM layer
          later).
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <a
            className="rounded-md border border-border px-2.5 py-1.5 font-medium text-foreground hover:bg-muted/50"
            href={`/api/taste/export?slug=${encodeURIComponent(exportSlug)}&format=json`}
            target="_blank"
            rel="noopener noreferrer"
          >
            JSON dossier
          </a>
          <a
            className="rounded-md border border-border px-2.5 py-1.5 font-medium text-foreground hover:bg-muted/50"
            href={`/api/taste/export?slug=${encodeURIComponent(exportSlug)}&format=md`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Markdown dossier
          </a>
          <Link
            href={`/u/${exportSlug}/ai-profile`}
            className="rounded-md border border-border px-2.5 py-1.5 font-medium text-foreground hover:bg-muted/50"
          >
            LLM landing page
          </Link>
        </div>
        <AiProfilePublicToggle initial={aiProfilePublic} />
      </header>

      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Your taste in one paragraph
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-foreground">
          {user_profile.taste_summary}
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Each saved link
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          What the item is about: stored title, heuristic summary, excerpt from
          the page when available, and the same{" "}
          <code className="rounded bg-muted px-1 text-[11px]">
            vector_ready_text
          </code>{" "}
          string that ships in the JSON export for models.
        </p>
        <ul className="mt-4 space-y-4">
          {saved_items.map((item, idx) => (
            <li
              key={`${item.normalized_url}-${idx}`}
              className="rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="text-sm font-medium leading-snug text-foreground">
                {item.title?.trim() || item.normalized_url}
              </div>
              <a
                href={item.normalized_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 block truncate text-xs text-primary underline-offset-2 hover:underline"
              >
                {item.normalized_url}
              </a>
              <p className="mt-2 text-xs text-muted-foreground">
                {item.content_type} · {item.domain}
                {item.author_publisher
                  ? ` · ${item.author_publisher}`
                  : null}
              </p>
              {item.summary ? (
                <p className="mt-2 text-sm leading-relaxed text-foreground">
                  {item.summary}
                </p>
              ) : null}
              {item.description ? (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
              {item.extracted_text_excerpt ? (
                <p className="mt-2 line-clamp-5 text-xs leading-relaxed text-muted-foreground">
                  {item.extracted_text_excerpt}
                </p>
              ) : null}
              {(item.topics.length > 0 || item.tags.length > 0) && (
                <p className="mt-2 text-xs text-foreground">
                  {item.topics.length > 0 && (
                    <>
                      <span className="font-medium text-muted-foreground">
                        Topics:{" "}
                      </span>
                      {item.topics.join(", ")}
                    </>
                  )}
                  {item.topics.length > 0 && item.tags.length > 0 && " · "}
                  {item.tags.length > 0 && (
                    <>
                      <span className="font-medium text-muted-foreground">
                        Tags:{" "}
                      </span>
                      {item.tags.join(", ")}
                    </>
                  )}
                </p>
              )}
              {item.vector_ready_text ? (
                <details className="mt-3 rounded-md border border-border bg-muted/20 p-2">
                  <summary className="cursor-pointer select-none text-xs font-medium text-foreground">
                    vector_ready_text (full)
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground">
                    {item.vector_ready_text}
                  </pre>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-8 sm:grid-cols-2">
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Top topics
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {user_profile.top_themes.slice(0, 12).map((t) => (
              <li key={t.label}>
                {t.label}{" "}
                <span className="text-muted-foreground">({t.weight})</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Top aesthetic directions
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {user_profile.top_aesthetics.slice(0, 10).map((a) => (
              <li key={a.label}>
                {a.label}{" "}
                <span className="text-muted-foreground">({a.weight})</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Content-type breakdown
        </h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {Object.entries(aggregate_stats.providers).map(([k, v]) => (
            <li
              key={k}
              className="rounded-md border border-border bg-muted/30 px-2 py-1 text-xs text-foreground"
            >
              {k}: {v}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Interest clusters
        </h2>
        <ul className="mt-2 space-y-2 text-sm text-foreground">
          {clusters.map((c) => (
            <li key={c.id} className="rounded-md border border-border px-3 py-2">
              <span className="font-medium">{c.label}</span>
              <span className="text-muted-foreground">
                {" "}
                — {c.link_ids.length} item(s)
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 rounded-md border border-border bg-muted/20 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Semantic overview
        </h2>
        <pre className="mt-2 whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">
          {user_profile.semantic_overview}
        </pre>
      </section>

      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Suggested directions (stub)
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Plug in embeddings + nearest-neighbor over public corpora, or an LLM
          planner reading{" "}
          <code className="rounded bg-muted px-1 text-xs">vector_ready_text</code>{" "}
          fields from the JSON export.
        </p>
      </section>
    </main>
  );
}
