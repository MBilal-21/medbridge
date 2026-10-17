import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

/**
 * Service-role client: bypasses RLS. Only use it after the caller has been
 * checked on the server (e.g. requireRole("admin")), never with user input
 * deciding whose data to touch.
 */
export function createAdminClient() {
  return createClient<Database>(
    supabaseEnv().url,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
