import { requireRole } from "@/lib/auth";
import { buildCalendar } from "@/lib/ics";
import { createClient } from "@/lib/supabase/server";

/** Calendar file with a reminder at each dose time of the patient's active medicines. */
export async function GET() {
  const user = await requireRole("patient");
  const supabase = await createClient();
  const { data: medicines } = await supabase
    .from("medications")
    .select("id, name_as_written, dose, instructions, dose_times, start_date, end_date, drug_products(brand_name)")
    .eq("patient_id", user.id)
    .eq("status", "active");

  const calendar = buildCalendar(
    (medicines ?? []).map((m) => ({
      ...m,
      name: m.drug_products?.brand_name ?? m.name_as_written,
      dose_times: m.dose_times ?? [],
    })),
  );
  return new Response(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="medbridge-medicines.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
