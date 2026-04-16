import nextDynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { ensureDistinctLinkSortOrdersForUser } from "@/lib/ensure-link-sort";
import { getAuthenticatedAppUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { serializeLink } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const LinkBoard = nextDynamic(
  () =>
    import("@/components/board/link-board").then((mod) => ({
      default: mod.LinkBoard,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading board…
      </div>
    ),
  }
);

export default async function BoardPage() {
  const ctx = await getAuthenticatedAppUser();
  if (!ctx) {
    redirect("/auth/signin?next=/board");
  }

  try {
    await ensureDistinctLinkSortOrdersForUser(ctx.appUser.id);

    const [links, userRecord] = await Promise.all([
      prisma.link.findMany({
        where: { userId: ctx.appUser.id },
        orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
      }),
      prisma.user.findUnique({
        where: { id: ctx.appUser.id },
        select: { openaiApiKey: true },
      }),
    ]);

    return (
      <LinkBoard
        initialLinks={links.map(serializeLink)}
        currentSlug={ctx.appUser.slug}
        currentEmail={ctx.appUser.email}
        hasOpenaiKey={Boolean(userRecord?.openaiApiKey)}
      />
    );
  } catch (e) {
    console.error("Database unavailable for initial load:", e);
    return (
      <LinkBoard initialLinks={[]} currentSlug={ctx.appUser.slug} currentEmail={ctx.appUser.email} hasOpenaiKey={false} />
    );
  }
}
