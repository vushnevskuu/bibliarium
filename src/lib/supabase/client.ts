import { createBrowserClient } from "@supabase/ssr";
import type { SupabasePublicConfig } from "@/lib/supabase/public-config";

declare global {
  interface Window {
    __BIBLIARIUM_SUPABASE__?: SupabasePublicConfig;
  }
}

function readRuntimePublicConfig(): SupabasePublicConfig | null {
  if (typeof window !== "undefined" && window.__BIBLIARIUM_SUPABASE__) {
    return window.__BIBLIARIUM_SUPABASE__;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (url && anonKey) return { url, anonKey };
  return null;
}

/** Публичный конфиг в браузере: inline-скрипт из layout или NEXT_PUBLIC в бандле. */
export function getBrowserSupabasePublicConfig(): SupabasePublicConfig | null {
  return readRuntimePublicConfig();
}

function resolveClientConfig(
  fromServer: SupabasePublicConfig | null | undefined
): SupabasePublicConfig | null {
  return fromServer ?? getBrowserSupabasePublicConfig();
}

/** Есть ли конфиг для клиента (серверный проп или window/бандл). */
export function isBrowserSupabaseConfigured(
  fromServer?: SupabasePublicConfig | null
): boolean {
  return resolveClientConfig(fromServer ?? null) !== null;
}

export function createBrowserSupabaseClientWithConfig(
  cfg: SupabasePublicConfig
) {
  return createBrowserClient(cfg.url, cfg.anonKey);
}

export function createBrowserSupabaseClient(
  fromServer?: SupabasePublicConfig | null
) {
  const cfg = resolveClientConfig(fromServer);
  if (!cfg) {
    throw new Error(
      "Missing Supabase config. Set env in Vercel and redeploy, or add SUPABASE_URL + SUPABASE_ANON_KEY."
    );
  }
  return createBrowserClient(cfg.url, cfg.anonKey);
}
