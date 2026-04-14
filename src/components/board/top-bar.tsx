"use client";

import * as React from "react";
import { Loader2, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function TopBar({
  onSubmit,
  busy,
  error,
  trailing,
}: {
  onSubmit: (url: string) => void;
  busy: boolean;
  error: string | null;
  trailing?: React.ReactNode;
}) {
  const [value, setValue] = React.useState("");
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v || busy) return;
    onSubmit(v);
    setValue("");
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <div className="group/topdock pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col">
      <div
        className="pointer-events-auto h-3 shrink-0 cursor-default bg-transparent"
        title="Наведите на верх страницы — появится поле для URL"
      />
      <div
        className={cn(
          "pointer-events-auto overflow-hidden border-b border-transparent bg-background/95 shadow-none backdrop-blur-sm",
          "max-h-0 opacity-0 transition-[max-height,opacity] duration-200 ease-out motion-reduce:transition-none",
          "group-hover/topdock:max-h-[min(55vh,380px)] group-hover/topdock:border-border group-hover/topdock:opacity-100 group-hover/topdock:shadow-md",
          "group-focus-within/topdock:max-h-[min(55vh,380px)] group-focus-within/topdock:border-border group-focus-within/topdock:opacity-100 group-focus-within/topdock:shadow-md",
          "[@media(hover:none)]:max-h-[min(55vh,380px)] [@media(hover:none)]:border-border [@media(hover:none)]:opacity-100 [@media(hover:none)]:shadow-sm"
        )}
      >
        <motion.header
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="relative border-b-0 bg-transparent"
        >
          <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 py-2.5 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <form onSubmit={handleSubmit} className="relative min-w-0 flex-1">
                  <label htmlFor="url-input" className="sr-only">
                    Paste URL
                  </label>
                  <input
                    id="url-input"
                    type="url"
                    inputMode="url"
                    placeholder="Paste any URL — YouTube, X, article, image…"
                    autoComplete="url"
                    value={value}
                    disabled={busy}
                    onChange={(e) => setValue(e.target.value)}
                    className={cn(
                      "h-10 w-full rounded-md border border-border bg-background pl-3.5 pr-11 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground/25 focus:ring-0 disabled:opacity-50",
                      error && "border-destructive/60"
                    )}
                  />
                  <button
                    type="submit"
                    disabled={busy || !value.trim()}
                    className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md bg-foreground text-background transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label="Add to board"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span className="text-lg leading-none">+</span>
                    )}
                  </button>
                </form>
              </div>

              {trailing ? (
                <div className="flex shrink-0 items-center gap-1.5">{trailing}</div>
              ) : null}
              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Toggle theme"
              >
                {mounted ? (
                  resolvedTheme === "dark" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )
                ) : (
                  <span className="h-4 w-4" />
                )}
              </button>
            </div>

            {error ? (
              <p className="text-xs font-medium text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </motion.header>
      </div>
    </div>
  );
}
