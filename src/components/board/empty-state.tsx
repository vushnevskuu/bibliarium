"use client";

import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center"
    >
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-md border border-border text-muted-foreground">
        <Sparkles className="h-5 w-5" strokeWidth={1.5} />
      </div>
      <h2 className="text-lg font-medium tracking-tight text-foreground sm:text-xl">
        Your board is empty
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Paste any URL above — we&apos;ll pull embeds, oEmbed, Open Graph, or a
        clean fallback. Build a living moodboard for research and inspiration.
      </p>
    </motion.div>
  );
}
