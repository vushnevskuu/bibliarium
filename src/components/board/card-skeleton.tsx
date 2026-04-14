"use client";

import { motion } from "framer-motion";

export function CardSkeleton() {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="break-inside-avoid overflow-hidden rounded-2xl border border-border bg-card"
    >
      <div className="skeleton aspect-video w-full rounded-none" />
    </motion.div>
  );
}
