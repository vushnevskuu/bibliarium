import { getSiteUrl } from "@/lib/site-url";

const faqCopy = [
  {
    q: "What is Bibliarium?",
    a: "A visual bookmark board for URLs: you paste links, see rich previews on a masonry layout, and each save gets a structured “taste” profile suitable for LLMs and research tools.",
  },
  {
    q: "How does sign-in work?",
    a: "You can use a passwordless email magic link or Google OAuth. Sessions use secure cookies; after sign-in you land on your personal board.",
  },
  {
    q: "Can I export my saved links for AI tools?",
    a: "Yes. Built-in flows produce JSON and Markdown dossiers that summarize your collection without requiring crawlers to fetch every original URL.",
  },
  {
    q: "Is my data public by default?",
    a: "No. Your board and AI profile exports stay private until you choose to share individual cards or enable a public profile page.",
  },
] as const;

export function LandingJsonLd() {
  const base = getSiteUrl();

  const graph = [
    {
      "@type": "Organization",
      "@id": `${base}/#organization`,
      name: "Bibliarium",
      url: base,
      description:
        "Visual taste board and AI-readable link profiles for researchers and curators.",
    },
    {
      "@type": "WebSite",
      "@id": `${base}/#website`,
      url: base,
      name: "Bibliarium",
      description:
        "Save URLs on a visual board; export structured taste profiles for LLMs.",
      publisher: { "@id": `${base}/#organization` },
      inLanguage: "en-US",
    },
    {
      "@type": "SoftwareApplication",
      name: "Bibliarium",
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      description:
        "Paste URLs into a masonry board; each card includes previews and an AI-readable profile with JSON/Markdown export.",
      url: base,
      publisher: { "@id": `${base}/#organization` },
    },
    {
      "@type": "FAQPage",
      mainEntity: faqCopy.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a,
        },
      })),
    },
  ];

  const payload = {
    "@context": "https://schema.org",
    "@graph": graph,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}

export { faqCopy };
