import { redirect } from "next/navigation";
import { buildTasteExportForSlug } from "@/lib/ai-taste/export-payload";
import { getAuthenticatedAppUser } from "@/lib/auth/session";
import { AnalysisView } from "@/components/analysis/analysis-view";
import { AnalysisShell } from "./analysis-shell";

export const dynamic = "force-dynamic";

export default async function AnalysisPage() {
  const ctx = await getAuthenticatedAppUser();
  if (!ctx) {
    redirect("/auth/signin?next=/analysis");
  }

  const built = await buildTasteExportForSlug(ctx.appUser.slug);

  return (
    <AnalysisShell boardSlug={ctx.appUser.slug}>
      <AnalysisView
        data={built?.json ?? null}
        exportSlug={ctx.appUser.slug}
        aiProfilePublic={ctx.appUser.aiProfilePublic}
      />
    </AnalysisShell>
  );
}
