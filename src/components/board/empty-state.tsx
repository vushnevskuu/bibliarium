"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

type Props = {
  onSubmit?: (url: string) => void;
  busy?: boolean;
  error?: string | null;
};

export function EmptyState({ onSubmit, busy, error }: Props) {
  const [value, setValue] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let v = value.trim();
    if (!v || busy || !onSubmit) return;
    // Ensure protocol so browsers and backend both accept it
    if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
    onSubmit(v);
    setValue("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 flex flex-col items-center justify-center text-center"
    >
      <p className="mb-1.5 text-sm text-muted-foreground">
        Drop your first link here.
      </p>
      <p className="mb-5 text-xs text-muted-foreground/50">
        After that — just Ctrl+V anywhere on the page.
      </p>

      <form onSubmit={handleSubmit} className="flex w-full max-w-[340px] gap-2">
        <input
          type="text"
          autoFocus
          placeholder="https://..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={busy}
          className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-foreground/30 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!value.trim() || busy}
          className="flex h-10 shrink-0 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-30"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
        </button>
      </form>

      {error && (
        <p className="mt-3 max-w-[340px] text-xs text-destructive">
          {error}
        </p>
      )}
    </motion.div>
  );
}
