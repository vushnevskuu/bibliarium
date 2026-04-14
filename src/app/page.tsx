import type { Metadata } from "next";
import { LandingJsonLd } from "@/components/landing/landing-json-ld";
import { LandingPage } from "@/components/landing/landing-page";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

const title =
  "Bibliarium — Visual link board & AI taste export for researchers";

const description =
  "Save YouTube, articles, and tools on a masonry board. Each link becomes an AI-readable taste profile; export JSON or Markdown for ChatGPT, Claude, and workflows. Magic link & Google sign-in.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "visual bookmark board",
    "URL organizer",
    "masonry board",
    "AI taste profile",
    "LLM export",
    "JSON Markdown dossier",
    "link curator",
    "research bookmarks",
    "magic link sign in",
  ],
  alternates: {
    canonical: `${getSiteUrl()}/`,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: `${getSiteUrl()}/`,
    siteName: "Bibliarium",
    title,
    description,
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function HomePage() {
  return (
    <>
      <LandingJsonLd />
      <LandingPage />
    </>
  );
}
