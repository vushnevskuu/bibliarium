import Link from "next/link";
import { notFound } from "next/navigation";
import { buildTasteExportForSlug } from "@/lib/ai-taste/export-payload";
import { getAuthenticatedAppUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { requestPublicBaseUrl } from "@/lib/request-public-base";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

export default async function AiProfileLandingPage({ params }: Props) {
  const user = await prisma.user.findUnique({
    where: { slug: params.slug },
  });
  if (!user) notFound();

  const ctx = await getAuthenticatedAppUser();
  const isOwner = ctx?.appUser.id === user.id;
  if (!user.aiProfilePublic && !isOwner) notFound();

  const built = await buildTasteExportForSlug(params.slug);
  if (!built) notFound();

  const base = requestPublicBaseUrl().replace(/\/$/, "");

  const jsonUrl = `${base}/api/taste/export?slug=${encodeURIComponent(params.slug)}&format=json`;
  const mdUrl = `${base}/api/taste/export?slug=${encodeURIComponent(params.slug)}&format=md`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          AI-readable taste profile
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          @{user.slug}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          This page is a stable entry point for external LLMs. Do not crawl
          every original URL — use the pre-built dossiers below. Each saved
          link has already been normalized into a structured profile with{" "}
          <code className="rounded bg-muted px-1 text-xs">vector_ready_text</code>{" "}
          for embeddings.
        </p>

        <section className="mt-8 space-y-3 rounded-md border border-border bg-card p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Human summary
          </h2>
          <p className="text-sm leading-relaxed">
            {built.json.user_profile.taste_summary}
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Machine exports
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a
                href={jsonUrl}
                className="font-medium text-foreground underline underline-offset-4"
                target="_blank"
                rel="noopener noreferrer"
              >
                JSON dossier
              </a>
              <span className="block break-all font-mono text-xs text-muted-foreground">
                {jsonUrl}
              </span>
            </li>
            <li className="pt-2">
              <a
                href={mdUrl}
                className="font-medium text-foreground underline underline-offset-4"
                target="_blank"
                rel="noopener noreferrer"
              >
                Markdown dossier
              </a>
              <span className="block break-all font-mono text-xs text-muted-foreground">
                {mdUrl}
              </span>
            </li>
          </ul>
        </section>

        <p className="mt-10 text-xs text-muted-foreground">
          URLs use this request&apos;s host (correct port in dev). In production
          behind a proxy, set{" "}
          <code className="rounded bg-muted px-1">NEXT_PUBLIC_APP_URL</code> as
          fallback when Host is missing.
        </p>

        <Link
          href="/board"
          className="mt-8 inline-block text-sm font-medium text-foreground underline underline-offset-4"
        >
          Open visual board
        </Link>
      </main>
    </div>
  );
}
