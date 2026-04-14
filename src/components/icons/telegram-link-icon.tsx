"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

export function TelegramLinkIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/telegram-link-icon.png"
      alt=""
      width={128}
      height={128}
      className={cn("h-7 w-7 shrink-0 rounded-full object-cover", className)}
      sizes="28px"
    />
  );
}
