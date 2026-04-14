"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { LinkSerialized } from "@/types/link";
import { PostDetailPanel } from "@/components/board/post-detail-panel";

export function LinkPostView({
  initialLink,
  readOnly = false,
}: {
  initialLink: LinkSerialized;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [link, setLink] = React.useState(initialLink);

  React.useEffect(() => {
    setLink(initialLink);
  }, [initialLink]);

  const onClose = React.useCallback(() => {
    router.push("/board");
  }, [router]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        aria-label="Close and return to board"
        className="absolute inset-0 bg-foreground/25 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-detail-title"
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="relative z-10 max-h-full w-full max-w-[min(98vw,1320px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <PostDetailPanel
          link={link}
          onClose={onClose}
          readOnly={readOnly}
          onPatched={readOnly ? undefined : setLink}
        />
      </motion.div>
    </div>
  );
}
