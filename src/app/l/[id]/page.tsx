import { notFound } from "next/navigation";
import { LinkPostView } from "@/components/board/link-post-view";
import { getAuthenticatedAppUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { serializeLink } from "@/lib/serialize";

export const dynamic = "force-dynamic";

type Props = { params: { id: string } };

export default async function LinkPostPage({ params }: Props) {
  const link = await prisma.link.findUnique({
    where: { id: params.id },
  });
  if (!link) notFound();

  const ctx = await getAuthenticatedAppUser();
  const isOwner = ctx?.appUser.id === link.userId;
  if (!link.isPublic && !isOwner) notFound();

  return (
    <div className="min-h-screen bg-background">
      <LinkPostView
        initialLink={serializeLink(link)}
        readOnly={!isOwner}
      />
    </div>
  );
}
