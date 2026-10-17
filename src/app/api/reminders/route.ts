import { timingSafeEqual } from "node:crypto";
import { appSetting, sendDueReminders } from "@/lib/reminders";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Called every 5 minutes by pg_cron (see the dose_reminders migration) with the
 * secret from app_settings. Emails the medicines that are due now.
 */
export async function POST(request: Request) {
  const admin = createAdminClient();
  const secret = await appSetting(admin, "cron_secret");
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await sendDueReminders(admin));
}
