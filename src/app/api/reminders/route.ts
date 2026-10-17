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
  const result = await sendDueReminders(admin);
  // Lets us confirm the schedule is running.
  await admin
    .from("app_settings")
    .upsert({ key: "reminders_last_run", value: JSON.stringify({ at: new Date().toISOString(), ...result }) });
  return Response.json(result);
}
