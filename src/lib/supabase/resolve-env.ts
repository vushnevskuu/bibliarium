/**
 * URL и anon key для Supabase.
 * Сначала непубличные имена (читаются на сервере/Edge в рантайме без обязательной пересборки),
 * затем NEXT_PUBLIC_* (локальная разработка и классический Vercel).
 */
export function resolveSupabaseFromProcessEnv(): {
  url: string;
  anonKey: string;
} | null {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}
