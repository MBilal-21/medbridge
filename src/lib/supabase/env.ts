/**
 * Supabase URL and publishable key, read when the request runs.
 *
 * `process.env.NEXT_PUBLIC_*` written out in full is replaced at build time,
 * so a host that only sets these at runtime would get `undefined`. Reading
 * through a variable is not replaced (see Next.js "Environment Variables").
 */
export function supabaseEnv() {
  const env = process.env;
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  };
}
