import type { AiLinkProfile, AiMasterProfile } from "./types";

function countMapAdd(m: Map<string, number>, key: string, n = 1) {
  m.set(key, (m.get(key) ?? 0) + n);
}

export function buildMasterProfile(
  userSlug: string,
  profiles: AiLinkProfile[],
  linkIds: string[]
): AiMasterProfile {
  const themeWeights = new Map<string, number>();
  const aestheticWeights = new Map<string, number>();
  const typeBreakdown: Record<string, number> = {};
  const domains = new Set<string>();
  const providers: Record<string, number> = {};

  for (const p of profiles) {
    domains.add(p.domain);
    const pt = p.content_type.split(":")[0] ?? "web";
    providers[pt] = (providers[pt] ?? 0) + 1;
    typeBreakdown[p.content_type] = (typeBreakdown[p.content_type] ?? 0) + 1;
    for (const t of p.topics) countMapAdd(themeWeights, t, 1);
    for (const a of p.aesthetic_style) countMapAdd(aestheticWeights, a, 1);
  }

  const top_themes = Array.from(themeWeights.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([label, weight]) => ({ label, weight }));

  const top_aesthetics = Array.from(aestheticWeights.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, weight]) => ({ label, weight }));

  const clusters: AiMasterProfile["clusters"] = [];
  const byProvider = new Map<string, string[]>();
  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i];
    const id = linkIds[i];
    if (!id) continue;
    const key = p.content_type.split(":")[0] ?? "web";
    const arr = byProvider.get(key) ?? [];
    arr.push(id);
    byProvider.set(key, arr);
  }
  for (const [label, link_ids] of Array.from(byProvider.entries())) {
    clusters.push({
      id: `cluster_${label}`,
      label: `${label} saves`,
      link_ids,
    });
  }

  const representative_link_ids = linkIds.slice(0, 5);

  const topThemeLabels = top_themes.slice(0, 5).map((t) => t.label);
  const topDomains = Array.from(domains).slice(0, 5);
  const taste_summary_paragraph =
    profiles.length === 0
      ? "No items saved yet — paste URLs on the board to build a taste profile."
      : `This collector has saved ${profiles.length} item(s) across ${domains.size} domain(s). ` +
        `Recurring themes include ${topThemeLabels.join(", ") || "mixed topics"}. ` +
        `Frequent sources include ${topDomains.join(", ")}. ` +
        `The mix skews toward ${Object.entries(providers)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([k]) => k)
          .join(", ")} content.`;

  const semantic_overview = [
    `Themes: ${topThemeLabels.join("; ") || "n/a"}`,
    `Aesthetics: ${top_aesthetics
      .slice(0, 5)
      .map((a) => a.label)
      .join("; ")}`,
    `Formats: ${Object.keys(typeBreakdown).slice(0, 8).join(", ")}`,
  ].join("\n");

  return {
    schema_version: 1,
    user_slug: userSlug,
    generated_at: new Date().toISOString(),
    taste_summary_paragraph,
    top_themes,
    top_aesthetics,
    content_type_breakdown: typeBreakdown,
    clusters,
    representative_link_ids,
    aggregate_stats: {
      total_items: profiles.length,
      unique_domains: domains.size,
      providers,
    },
    semantic_overview,
    saved_items: profiles,
  };
}

export function masterProfileToMarkdown(
  m: AiMasterProfile,
  linkIds: string[]
): string {
  const lines: string[] = [
    `# Taste dossier — ${m.user_slug}`,
    ``,
    `Generated: ${m.generated_at}`,
    ``,
    `## Taste in one paragraph`,
    ``,
    m.taste_summary_paragraph,
    ``,
    `## Top themes`,
    ...m.top_themes.map((t) => `- **${t.label}** (${t.weight})`),
    ``,
    `## Top aesthetic directions`,
    ...m.top_aesthetics.map((a) => `- **${a.label}** (${a.weight})`),
    ``,
    `## Main clusters`,
    ...m.clusters.map(
      (c) => `- **${c.label}**: ${c.link_ids.length} item(s)`
    ),
    ``,
    `## Representative links`,
  ];

  for (const id of m.representative_link_ids) {
    const idx = linkIds.indexOf(id);
    const profile = idx >= 0 ? m.saved_items[idx] : undefined;
    if (profile) {
      const blurb =
        profile.summary.length > 120
          ? `${profile.summary.slice(0, 120)}…`
          : profile.summary;
      lines.push(
        `- [${profile.title ?? profile.domain}](${profile.normalized_url}) — ${blurb}`
      );
    }
  }

  lines.push(``, `## Semantic overview`, ``, "```text", m.semantic_overview, "```", ``);

  lines.push(
    `## Full item profiles`,
    ``,
    `See JSON export for machine-readable \`saved_items\` with vector_ready_text per link.`
  );

  return lines.join("\n");
}
