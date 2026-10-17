import "server-only";
import { sendEmail } from "@/lib/email";
import { dueAt, formatTime, nowInPakistan } from "@/lib/schedule";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

// The cron runs every 5 minutes. A dose due in the last 20 minutes still gets its
// email if a run was missed; dose_reminders makes sure it is only sent once.
const WINDOW_MS = 20 * 60 * 1000;

export async function appSetting(admin: Admin, key: string) {
  const { data } = await admin.from("app_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

type Due = {
  patientId: string;
  email: string;
  name: string;
  dueAt: Date;
  time: string;
  medicines: { id: string; name: string; dose: string | null; instructions: string | null }[];
};

/** Emails every patient whose dose time has just come, one email per patient per time. */
export async function sendDueReminders(admin: Admin, now = new Date()) {
  const today = nowInPakistan(now).date;
  const yesterday = nowInPakistan(new Date(now.getTime() - 24 * 60 * 60 * 1000)).date;

  const { data: meds } = await admin
    .from("medications")
    .select(
      "id, patient_id, name_as_written, dose, instructions, dose_times, start_date, end_date, drug_products(brand_name), profiles!medications_patient_id_fkey(email, full_name, dose_reminders)",
    )
    .eq("status", "active");

  const due = new Map<string, Due>();
  for (const m of meds ?? []) {
    if (!m.profiles?.dose_reminders || !m.profiles.email) continue;
    // A window that crosses midnight can include yesterday's late doses.
    for (const date of [today, yesterday]) {
      if (m.start_date && m.start_date > date) continue;
      if (m.end_date && m.end_date < date) continue;
      for (const time of m.dose_times ?? []) {
        const at = dueAt(date, time);
        const age = now.getTime() - at.getTime();
        if (age < 0 || age > WINDOW_MS) continue;
        const key = `${m.patient_id}|${at.toISOString()}`;
        const entry = due.get(key) ?? {
          patientId: m.patient_id,
          email: m.profiles.email,
          name: m.profiles.full_name,
          dueAt: at,
          time,
          medicines: [],
        };
        entry.medicines.push({
          id: m.id,
          name: m.drug_products?.brand_name ?? m.name_as_written,
          dose: m.dose,
          instructions: m.instructions,
        });
        due.set(key, entry);
      }
    }
  }
  if (!due.size) return { due: 0, sent: 0, failed: 0 };

  // Claim each (patient, time) first. Rows that already exist were sent by an earlier run.
  const { data: claimed } = await admin
    .from("dose_reminders")
    .upsert(
      [...due.values()].map((d) => ({
        patient_id: d.patientId,
        due_at: d.dueAt.toISOString(),
        medication_ids: d.medicines.map((m) => m.id),
      })),
      { onConflict: "patient_id,due_at", ignoreDuplicates: true },
    )
    .select("id, patient_id, due_at");

  const appUrl = (await appSetting(admin, "app_url"))?.replace(/\/$/, "") ?? null;
  let sent = 0;
  let failed = 0;
  for (const row of claimed ?? []) {
    const d = due.get(`${row.patient_id}|${new Date(row.due_at).toISOString()}`);
    if (!d) continue;
    try {
      await sendEmail({
        to: d.email,
        subject: `Time for your ${formatTime(d.time)} medicines`,
        html: reminderHtml(d, appUrl),
      });
      await admin.from("dose_reminders").update({ sent_at: new Date().toISOString() }).eq("id", row.id);
      sent++;
    } catch (err) {
      await admin
        .from("dose_reminders")
        .update({ error: err instanceof Error ? err.message : "Email failed" })
        .eq("id", row.id);
      failed++;
    }
  }
  return { due: due.size, sent, failed };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function reminderHtml(d: Due, appUrl: string | null) {
  const items = d.medicines
    .map(
      (m) =>
        `<li style="margin:0 0 8px"><strong>${escapeHtml(m.name)}</strong>${m.dose ? ` ${escapeHtml(m.dose)}` : ""}${
          m.instructions ? `<br><span style="color:#475467">${escapeHtml(m.instructions)}</span>` : ""
        }</li>`,
    )
    .join("");
  const link = appUrl
    ? `<p><a href="${appUrl}/patient" style="color:#175cd3">Open your medicine pack</a> · <a href="${appUrl}/patient#reminders" style="color:#475467">Turn off reminders</a></p>`
    : "";
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:16px;line-height:1.5;color:#101828;max-width:560px">
<h1 style="font-size:22px">${escapeHtml(d.name ? `${d.name.split(" ")[0]}, it's` : "It's")} time for your ${formatTime(d.time)} medicines</h1>
<ul style="padding-left:20px">${items}</ul>
<p style="color:#475467;font-size:14px">This list was checked by your doctor. Don't take any medicine your doctor told you to stop.</p>
${link}
</div>`;
}
