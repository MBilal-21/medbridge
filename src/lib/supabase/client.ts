import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * Supabase client for the browser, acting as the signed-in user. RLS applies.
 * The server passes the URL and key in, so they come from runtime config.
 */
export function createClient(url: string, publishableKey: string) {
  return createBrowserClient<Database>(url, publishableKey);
}
