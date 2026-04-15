import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { serializeLink } from "@/lib/serialize";
import { PublicBoard } from "@/components/board/public-board";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

export default async function PublicBoardPage({ params }: Props) {
  const user = await prisma.user.findUnique({
    where: { slug: params.slug },
  });
  if (!user) notFound();

  const links = await prisma.link.findMany({
    where: { userId: user.id },
    orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
  });

  return (
    <PublicBoard
      email={user.email}
      links={links.map(serializeLink)}
    />
  );
}
