/**
 * Full taste dossier rebuild for one user: clears cached per-link aiProfileJson, re-runs item + master pipeline.
 *
 * Usage: npx tsx scripts/rebuild-taste-dossier.ts <slug>
 * Loads `.env` from repo root (so Prisma sees DATABASE_URL even when the shell does not).
 */

import fs from "node:fs";
import path from "node:path";

function loadDotEnvFromRepoRoot(): void {
  const p = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(p)) return;
  const raw = fs.readFileSync(p, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadDotEnvFromRepoRoot();

async function main() {
  const { buildTasteExportForSlug } = await import("../src/lib/ai-taste/export-payload");
  const { prisma } = await import("../src/lib/prisma");

  const db = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\//i.test(db)) {
    console.error(
      "DATABASE_URL must start with postgresql:// or postgres:// (save .env on disk, not only in editor buffer).",
    );
    process.exit(1);
  }

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

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
