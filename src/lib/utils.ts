import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function faviconForDomain(domain: string): string {
  const d = domain.replace(/^www\./, "");
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64`;
}
