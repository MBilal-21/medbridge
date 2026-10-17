import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { CalendarMedicine } from "@/lib/ics";

type Client = SupabaseClient<Database>;
export type Decision = Database["public"]["Enums"]["decision_type"];

export type ReviewItem = CalendarMedicine & {
  decision: Decision;
  note: string | null;
  frequency: string | null;
};

/** Order the patient reads their list in: what to stop first. */
export const decisionOrder: Decision[] = ["stop", "change", "new", "continue"];

/** The doctor's decisions from one check, as the patient's STOP / CHANGE / NEW / CONTINUE list. */
export async function loadReview(supabase: Client, checkId: string) {
  const [{ data: check }, { data: rows }] = await Promise.all([
    supabase
      .from("reconciliation_checks")
      .select("id, patient_id, reviewed_at, doctors(profiles!doctors_profile_id_fkey(full_name))")
      .eq("id", checkId)
      .maybeSingle(),
    supabase
      .from("medication_decisions")
      .select(
        "decision, note, medications(id, name_as_written, dose, frequency, dose_times, instructions, start_date, end_date, drug_products(brand_name, strength))",
      )
      .eq("check_id", checkId),
  ]);
  if (!check) return null;

  const items: ReviewItem[] = (rows ?? [])
    .filter((r) => r.medications)
    .map(({ decision, note, medications: m }) => ({
      id: m!.id,
      name: [m!.drug_products?.brand_name ?? m!.name_as_written, m!.drug_products?.strength]
        .filter(Boolean)
        .join(" "),
      dose: m!.dose,
      frequency: m!.frequency,
      instructions: m!.instructions,
      dose_times: m!.dose_times ?? [],
      start_date: m!.start_date,
      end_date: m!.end_date,
      decision,
      note,
    }))
    .sort((a, b) => decisionOrder.indexOf(a.decision) - decisionOrder.indexOf(b.decision));

  return {
    checkId: check.id,
    patientId: check.patient_id,
    reviewedAt: check.reviewed_at,
    doctorName: check.doctors?.profiles?.full_name || "your doctor",
    items,
  };
}

const colours: Record<Decision, string> = {
  stop: "#b42318",
  change: "#b54708",
  new: "#175cd3",
  continue: "#067647",
};

const headings: Record<Decision, string> = {
  stop: "STOP taking",
  change: "CHANGE how you take",
  new: "NEW medicines",
  continue: "CONTINUE taking",
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Email version of the list. Plain HTML with inline styles so it works in every mail app. */
export function reviewEmailHtml(review: NonNullable<Awaited<ReturnType<typeof loadReview>>>) {
  const sections = decisionOrder
    .map((d) => {
      const items = review.items.filter((i) => i.decision === d);
      if (!items.length) return "";
      const lines = items
        .map((i) => {
          const details = [i.dose, i.frequency, i.dose_times.map((t) => t.slice(0, 5)).join(", "), i.instructions]
            .filter(Boolean)
            .join(" · ");
          return `<li style="margin:0 0 8px"><strong>${escapeHtml(i.name)}</strong>${
            details && d !== "stop" ? `<br><span style="color:#475467">${escapeHtml(details)}</span>` : ""
          }${i.note ? `<br><em>Doctor's note: ${escapeHtml(i.note)}</em>` : ""}</li>`;
        })
        .join("");
      return `<h2 style="font-size:18px;color:${colours[d]};margin:24px 0 8px">${headings[d]}</h2><ul style="padding-left:20px;margin:0">${lines}</ul>`;
    })
    .join("");

  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:16px;line-height:1.5;color:#101828;max-width:560px">
<h1 style="font-size:22px">Your medicine list from ${escapeHtml(review.doctorName)}</h1>
<p>Your doctor checked every medicine you take, from every doctor. Please follow this list.</p>
${sections}
<p style="margin-top:24px">The attached calendar file adds a reminder at each dose time. Open it on your phone to add it to your calendar.</p>
<p style="color:#475467;font-size:14px">If anything is unclear, ask your doctor or pharmacist before changing how you take a medicine.</p>
</div>`;
}
