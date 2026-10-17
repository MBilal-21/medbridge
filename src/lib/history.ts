import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type Decision = Database["public"]["Enums"]["decision_type"];
export type MedicineStatus = Database["public"]["Enums"]["medication_status"];

export type HistoryMedicine = {
  id: string;
  name: string;
  details: string;
  status: MedicineStatus;
  /** Set when a doctor stopped it in a review. */
  stopped: { on: string; by: string; note: string | null } | null;
};

export type HistoryEvent =
  | {
      kind: "prescription";
      id: string;
      at: string;
      source: "in_app" | "photo_upload";
      doctor: string;
      specialty: string | null;
      medicines: HistoryMedicine[];
    }
  | {
      kind: "review";
      id: string;
      at: string;
      doctor: string;
      specialty: string | null;
      decisions: { decision: Decision; name: string; note: string | null }[];
    };

export type CareTeamMember = {
  name: string;
  specialty: string | null;
  external: boolean;
  current: number;
  lastSeen: string;
};

const nameOf = (m: { name_as_written: string; drug_products: { brand_name: string; strength: string | null } | null }) =>
  [m.drug_products?.brand_name ?? m.name_as_written, m.drug_products?.strength].filter(Boolean).join(" ");

/**
 * A patient's medicine history: every prescription (from MedBridge doctors and
 * from photos) and every finished doctor review, newest first. Reads with the
 * caller's client, so RLS decides who sees it.
 */
export async function loadHistory(supabase: Client, patientId: string) {
  const [{ data: prescriptions }, { data: reviews }] = await Promise.all([
    supabase
      .from("prescriptions")
      .select(
        "id, source, prescribed_on, created_at, external_doctor_name, doctors(specialty, profiles!doctors_profile_id_fkey(full_name)), medications(id, name_as_written, dose, frequency, instructions, status, drug_products(brand_name, strength))",
      )
      .eq("patient_id", patientId),
    supabase
      .from("reconciliation_checks")
      .select(
        "id, reviewed_at, doctors(specialty, profiles!doctors_profile_id_fkey(full_name)), medication_decisions(decision, note, medications(id, name_as_written, drug_products(brand_name, strength)))",
      )
      .eq("patient_id", patientId)
      .eq("status", "reviewed"),
  ]);

  // Who stopped each medicine, and when, from the reviews.
  const stops = new Map<string, { on: string; by: string; note: string | null }>();
  for (const r of reviews ?? []) {
    for (const d of r.medication_decisions) {
      if (d.decision === "stop" && d.medications && r.reviewed_at) {
        stops.set(d.medications.id, {
          on: r.reviewed_at,
          by: r.doctors?.profiles?.full_name || "Your doctor",
          note: d.note,
        });
      }
    }
  }

  const events: HistoryEvent[] = [
    ...(prescriptions ?? []).map((p) => ({
      kind: "prescription" as const,
      id: p.id,
      // The date written on the prescription; noon keeps it on the same day in any time zone.
      at: p.prescribed_on ? `${p.prescribed_on}T12:00:00+05:00` : p.created_at,
      source: p.source,
      doctor: p.doctors?.profiles?.full_name || p.external_doctor_name || "Unknown doctor",
      specialty: p.doctors?.specialty ?? (p.source === "photo_upload" ? "Outside MedBridge" : null),
      medicines: p.medications
        .map((m) => ({
          id: m.id,
          name: nameOf(m),
          details: [m.dose, m.frequency, m.instructions].filter(Boolean).join(" · "),
          status: m.status,
          stopped: stops.get(m.id) ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    })),
    ...(reviews ?? [])
      .filter((r) => r.reviewed_at)
      .map((r) => ({
        kind: "review" as const,
        id: r.id,
        at: r.reviewed_at!,
        doctor: r.doctors?.profiles?.full_name || "Your doctor",
        specialty: r.doctors?.specialty ?? null,
        decisions: r.medication_decisions
          .filter((d) => d.medications)
          .map((d) => ({ decision: d.decision, name: nameOf(d.medications!), note: d.note })),
      })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  // Every doctor who has prescribed, with how many of their medicines are still taken.
  const team = new Map<string, CareTeamMember>();
  for (const e of events) {
    if (e.kind !== "prescription") continue;
    const member = team.get(e.doctor) ?? {
      name: e.doctor,
      specialty: e.specialty,
      external: e.source === "photo_upload",
      current: 0,
      lastSeen: e.at,
    };
    member.current += e.medicines.filter((m) => m.status === "active").length;
    if (e.at > member.lastSeen) member.lastSeen = e.at;
    team.set(e.doctor, member);
  }

  return {
    events,
    careTeam: [...team.values()].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)),
  };
}
