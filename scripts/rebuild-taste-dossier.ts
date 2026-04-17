/**
 * Full taste dossier rebuild for one user: clears cached per-link aiProfileJson, re-runs item + master pipeline.
 *
 * Usage: npx tsx scripts/rebuild-taste-dossier.ts <slug>
 * Requires DATABASE_URL and OPENAI_API_KEY or user openaiApiKey in DB.
 */

import { buildTasteExportForSlug } from "../src/lib/ai-taste/export-payload";
import { prisma } from "../src/lib/prisma";

async function main() {
  const slug = process.argv[2]?.trim();
  if (!slug) {
    const users = await prisma.user.findMany({
      take: 30,
      select: { slug: true, _count: { select: { links: true } } },
      orderBy: { links: { _count: "desc" } },
    });
    console.error("Usage: npx tsx scripts/rebuild-taste-dossier.ts <user-slug>");
    console.error(
      "Users (top by link count):",
      users.map(u => `${u.slug}(${u._count.links})`).join(", ") || "(none)",
    );
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { slug },
    select: { id: true, slug: true, _count: { select: { links: true } } },
  });
  if (!user) {
    console.error(`No user with slug: ${slug}`);
    process.exit(1);
  }

  console.log(`Rebuilding taste dossier for ${user.slug} (${user._count.links} links)…`);
  const built = await buildTasteExportForSlug(user.slug, null, { invalidateCachedItemProfiles: true });
  if (!built) {
    console.error("buildTasteExportForSlug returned null");
    process.exit(1);
  }

  const n = built.json.saved_items?.length ?? 0;
  const vp = built.master.visual_profile;
  console.log("Done.", {
    items: n,
    visualSignals: vp?.recurring_visual_signals?.length ?? 0,
    visualConfidence: vp?.confidence ?? null,
    masterConfidence: built.master.master_summary?.confidence ?? null,
    psychTraits: built.master.taste_psychology?.trait_hypotheses?.length ?? 0,
  });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
