import { PrismaClient } from "@prisma/client";
import { buildLinkAiProfile } from "../src/lib/ai-taste/build-link-profile";
import { normalizeUrlString } from "../src/lib/url-parse";

const prisma = new PrismaClient();

/** Stable local demo profile (not a real Supabase account). Reseed after `db push`. */
export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

async function main() {
  const demo = await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    create: {
      id: DEMO_USER_ID,
      slug: "demo",
      email: "demo@example.local",
      displayName: "Demo collector",
      authProvider: "seed",
      aiProfilePublic: true,
    },
    update: {
      displayName: "Demo collector",
      aiProfilePublic: true,
    },
  });

  const refs = await prisma.collection.upsert({
    where: {
      userId_slug: { userId: demo.id, slug: "references" },
    },
    create: {
      userId: demo.id,
      name: "References",
      slug: "references",
    },
    update: {},
  });

  await prisma.collection.upsert({
    where: {
      userId_slug: { userId: demo.id, slug: "reading" },
    },
    create: {
      userId: demo.id,
      name: "Reading list",
      slug: "reading",
    },
    update: {},
  });

  const yt = normalizeUrlString("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  const ytProfile = buildLinkAiProfile({
    normalizedUrl: yt,
    url: yt,
    canonicalUrl: null,
    title: "YouTube · classic embed demo",
    description: null,
    domain: "youtube.com",
    provider: "youtube",
    previewType: "embed",
    imageUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    faviconUrl: "https://www.google.com/s2/favicons?domain=youtube.com&sz=64",
    siteName: "YouTube",
    author: null,
    publishedAt: null,
    extractedText: null,
    oEmbedAuthor: null,
  });
  await prisma.link.upsert({
    where: {
      userId_normalizedUrl: { userId: demo.id, normalizedUrl: yt },
    },
    create: {
      url: yt,
      normalizedUrl: yt,
      title: "YouTube · classic embed demo",
      description: null,
      imageUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      faviconUrl: "https://www.google.com/s2/favicons?domain=youtube.com&sz=64",
      siteName: "YouTube",
      domain: "youtube.com",
      provider: "youtube",
      previewType: "embed",
      embedHtml: null,
      embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      tagsJson: "[]",
      collectionId: refs.id,
      userId: demo.id,
      isPublic: true,
      aiProfileJson: JSON.stringify(ytProfile),
      ingestionStatus: "complete",
    },
    update: { userId: demo.id },
  });

  const wiki = normalizeUrlString(
    "https://en.wikipedia.org/wiki/Link_(The_Legend_of_Zelda)"
  );
  const wikiExtracted =
    "Link is the main character. The Legend of Zelda is a Nintendo franchise.";
  const wikiProfile = buildLinkAiProfile({
    normalizedUrl: wiki,
    url: wiki,
    canonicalUrl: null,
    title: "Link (The Legend of Zelda)",
    description:
      "Link is a character and the protagonist of Nintendo's The Legend of Zelda series.",
    domain: "en.wikipedia.org",
    provider: "article",
    previewType: "og",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/en/2/21/Link_of_the_Wild.png",
    faviconUrl:
      "https://www.google.com/s2/favicons?domain=wikipedia.org&sz=64",
    siteName: "Wikipedia",
    author: null,
    publishedAt: null,
    extractedText: wikiExtracted,
    oEmbedAuthor: null,
  });
  await prisma.link.upsert({
    where: {
      userId_normalizedUrl: { userId: demo.id, normalizedUrl: wiki },
    },
    create: {
      url: wiki,
      normalizedUrl: wiki,
      title: "Link (The Legend of Zelda)",
      description:
        "Link is a character and the protagonist of Nintendo's The Legend of Zelda series.",
      imageUrl:
        "https://upload.wikimedia.org/wikipedia/en/2/21/Link_of_the_Wild.png",
      faviconUrl:
        "https://www.google.com/s2/favicons?domain=wikipedia.org&sz=64",
      siteName: "Wikipedia",
      domain: "en.wikipedia.org",
      provider: "article",
      previewType: "og",
      embedHtml: null,
      embedUrl: null,
      tagsJson: "[]",
      collectionId: refs.id,
      userId: demo.id,
      isPublic: true,
      extractedText: wikiExtracted,
      aiProfileJson: JSON.stringify(wikiProfile),
      ingestionStatus: "complete",
    },
    update: { userId: demo.id },
  });

  const img = normalizeUrlString(
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80"
  );
  const imgProfile = buildLinkAiProfile({
    normalizedUrl: img,
    url: img,
    canonicalUrl: null,
    title: "Mountain landscape (Unsplash)",
    description: null,
    domain: "images.unsplash.com",
    provider: "image",
    previewType: "image",
    imageUrl: img,
    faviconUrl: "https://www.google.com/s2/favicons?domain=unsplash.com&sz=64",
    siteName: "Unsplash",
    author: null,
    publishedAt: null,
    extractedText: null,
    oEmbedAuthor: null,
  });
  await prisma.link.upsert({
    where: {
      userId_normalizedUrl: { userId: demo.id, normalizedUrl: img },
    },
    create: {
      url: img,
      normalizedUrl: img,
      title: "Mountain landscape (Unsplash)",
      description: null,
      imageUrl: img,
      faviconUrl: "https://www.google.com/s2/favicons?domain=unsplash.com&sz=64",
      siteName: "Unsplash",
      domain: "images.unsplash.com",
      provider: "image",
      previewType: "image",
      embedHtml: null,
      embedUrl: null,
      tagsJson: "[]",
      collectionId: null,
      userId: demo.id,
      isPublic: true,
      aiProfileJson: JSON.stringify(imgProfile),
      ingestionStatus: "complete",
    },
    update: { userId: demo.id },
  });

  const vercel = normalizeUrlString("https://vercel.com/templates");
  const vercelProfile = buildLinkAiProfile({
    normalizedUrl: vercel,
    url: vercel,
    canonicalUrl: null,
    title: "Vercel Templates",
    description: "Jumpstart your Next.js development with pre-built apps.",
    domain: "vercel.com",
    provider: "web",
    previewType: "og",
    imageUrl: null,
    faviconUrl: "https://www.google.com/s2/favicons?domain=vercel.com&sz=64",
    siteName: "Vercel",
    author: null,
    publishedAt: null,
    extractedText: null,
    oEmbedAuthor: null,
  });
  await prisma.link.upsert({
    where: {
      userId_normalizedUrl: { userId: demo.id, normalizedUrl: vercel },
    },
    create: {
      url: vercel,
      normalizedUrl: vercel,
      title: "Vercel Templates",
      description: "Jumpstart your Next.js development with pre-built apps.",
      imageUrl: null,
      faviconUrl: "https://www.google.com/s2/favicons?domain=vercel.com&sz=64",
      siteName: "Vercel",
      domain: "vercel.com",
      provider: "web",
      previewType: "og",
      embedHtml: null,
      embedUrl: null,
      tagsJson: "[]",
      collectionId: null,
      userId: demo.id,
      isPublic: true,
      aiProfileJson: JSON.stringify(vercelProfile),
      ingestionStatus: "complete",
    },
    update: { userId: demo.id },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
