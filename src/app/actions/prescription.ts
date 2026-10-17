"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { explainFindings } from "@/lib/ai";
import { requireRole } from "@/lib/auth";
import { findProblems, matchProduct } from "@/lib/drugs";
import { sendEmail } from "@/lib/email";
import { frequencyByValue } from "@/lib/frequencies";
import type { FormState } from "@/lib/form-state";
import { buildCalendar } from "@/lib/ics";
import { loadReview, reviewEmailHtml, type Decision } from "@/lib/review";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const medicineSchema = z.object({
  name: z.string().trim().min(2, "Enter the medicine name."),
  strength: z.string().trim().max(40),
  frequency: z.string().refine((v) => !!frequencyByValue(v), "Choose how often to take it."),
  days: z.union([z.literal(""), z.coerce.number().int().min(1).max(365)]),
  instructions: z.string().trim().max(200),
});

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Saves the doctor's new prescription, then checks the patient's whole list.
 * The drug database finds the problems; the AI only explains them.
 */
export async function createPrescription(
  appointmentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireRole("doctor");
  if (user.doctorStatus !== "approved") return { error: "Your account is not verified yet." };

  const column = (key: string) => formData.getAll(key).map(String);
  const names = column("name");
  const rows = names.map((name, i) => ({
    name,
    strength: column("strength")[i] ?? "",
    frequency: column("frequency")[i] ?? "",
    days: column("days")[i] ?? "",
    instructions: column("instructions")[i] ?? "",
  }));
  const filled = rows.filter((r) => r.name.trim());
  if (!filled.length) return { error: "Add at least one medicine." };

  const medicines = [];
  for (const [i, row] of filled.entries()) {
    const parsed = medicineSchema.safeParse(row);
    if (!parsed.success) return { error: `Medicine ${i + 1}: ${parsed.error.issues[0].message}` };
    medicines.push(parsed.data);
  }

  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, patient_id")
    .eq("id", appointmentId)
    .eq("doctor_id", user.id)
    .in("status", ["requested", "confirmed"])
    .maybeSingle();
  if (!appointment) return { error: "This appointment is closed. You can't add a prescription to it." };

  const today = new Date().toISOString().slice(0, 10);
  const { data: prescription, error: rxError } = await supabase
    .from("prescriptions")
    .insert({
      patient_id: appointment.patient_id,
      source: "in_app",
      doctor_id: user.id,
      appointment_id: appointment.id,
      prescribed_on: today,
    })
    .select("id")
    .single();
  if (rxError || !prescription) return { error: "Could not save the prescription. Please try again." };

  const admin = createAdminClient();
  const productIds = await Promise.all(medicines.map((m) => matchProduct(admin, m.name, m.strength)));

  const { error: medError } = await supabase.from("medications").insert(
    medicines.map((m, i) => {
      const frequency = frequencyByValue(m.frequency)!;
      return {
        patient_id: appointment.patient_id,
        prescription_id: prescription.id,
        drug_product_id: productIds[i],
        name_as_written: m.name,
        dose: m.strength || null,
        frequency: frequency.label,
        dose_times: [...frequency.times],
        instructions: m.instructions || null,
        start_date: today,
        end_date: m.days === "" ? null : addDays(m.days),
        patient_confirmed: true,
      };
    }),
  );
  if (medError) {
    await admin.from("prescriptions").delete().eq("id", prescription.id);
    return { error: "Could not save the medicines. Please try again." };
  }

  const result = await runCheck(admin, {
    patientId: appointment.patient_id,
    doctorId: user.id,
    appointmentId: appointment.id,
    prescriptionId: prescription.id,
  });
  if (!result) return { error: "The prescription was saved, but the check failed. Please try again." };

  refresh();
  return { success: checkSummary(result) };
}

/**
 * Checks the current list and opens the doctor's STOP / CONTINUE / CHANGE
 * decisions, without prescribing anything new.
 */
export async function reviewCurrentList(appointmentId: string) {
  const user = await requireRole("doctor");
  if (user.doctorStatus !== "approved") return;
  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, patient_id")
    .eq("id", appointmentId)
    .eq("doctor_id", user.id)
    .in("status", ["requested", "confirmed"])
    .maybeSingle();
  if (!appointment) return;
  await runCheck(createAdminClient(), {
    patientId: appointment.patient_id,
    doctorId: user.id,
    appointmentId: appointment.id,
    prescriptionId: null,
  });
  refresh();
}

/**
 * Runs the drug check on the patient's whole active list and saves it with
 * the AI's plain-language explanation of each finding, for the doctor to review.
 */
async function runCheck(
  admin: ReturnType<typeof createAdminClient>,
  opts: { patientId: string; doctorId: string; appointmentId: string; prescriptionId: string | null },
) {
  const started = Date.now();
  const { flags, medicationsChecked } = await findProblems(admin, opts.patientId);
  const durationMs = Date.now() - started;

  const { data: check } = await admin
    .from("reconciliation_checks")
    .insert({
      patient_id: opts.patientId,
      doctor_id: opts.doctorId,
      appointment_id: opts.appointmentId,
      new_prescription_id: opts.prescriptionId,
      medications_checked: medicationsChecked,
      duration_ms: durationMs,
    })
    .select("id")
    .single();
  if (!check) return null;

  if (flags.length) {
    const explanations = await explainFindings(
      flags.map((f, i) => ({ id: String(i), type: f.type, severity: f.severity, medicines: f.medicines, finding: f.finding })),
    );
    await admin.from("check_flags").insert(
      flags.map((f, i) => ({
        check_id: check.id,
        type: f.type,
        severity: f.severity,
        medication_a_id: f.medication_a_id,
        medication_b_id: f.medication_b_id,
        ingredient_rxcui: f.ingredient_rxcui,
        source: f.source,
        finding: f.finding,
        ai_explanation: explanations.get(String(i)) ?? null,
      })),
    );
  }
  return { flags: flags.length, medicationsChecked, durationMs };
}

function checkSummary({ flags, medicationsChecked, durationMs }: { flags: number; medicationsChecked: number; durationMs: number }) {
  const seconds = (durationMs / 1000).toFixed(1);
  return flags
    ? `Checked ${medicationsChecked} medicines in ${seconds} s. ${flags} warning${flags > 1 ? "s" : ""} to review below.`
    : `Checked ${medicationsChecked} medicines in ${seconds} s. No problems found.`;
}

const allowed = {
  newMedicine: ["new", "change", "stop"],
  existing: ["continue", "change", "stop"],
} as const;

/** Saves the doctor's STOP / CONTINUE / NEW / CHANGE decision for every medicine and sends the list to the patient. */
export async function submitDecisions(checkId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole("doctor");
  if (user.doctorStatus !== "approved") return { error: "Your account is not verified yet." };

  const supabase = await createClient();
  const { data: check } = await supabase
    .from("reconciliation_checks")
    .select("id, patient_id, new_prescription_id")
    .eq("id", checkId)
    .eq("doctor_id", user.id)
    .eq("status", "pending_review")
    .maybeSingle();
  if (!check) return { error: "This check was already sent to the patient." };

  const { data: medicines } = await supabase
    .from("medications")
    .select("id, name_as_written, prescription_id")
    .eq("patient_id", check.patient_id)
    .eq("status", "active");
  if (!medicines?.length) return { error: "This patient has no active medicines." };

  const decisions = [];
  for (const m of medicines) {
    const decision = String(formData.get(`decision-${m.id}`) ?? "");
    const note = String(formData.get(`note-${m.id}`) ?? "").trim();
    const options: readonly string[] =
      m.prescription_id === check.new_prescription_id ? allowed.newMedicine : allowed.existing;
    if (!options.includes(decision)) return { error: `Choose what to do with ${m.name_as_written}.` };
    if (decision === "change" && note.length < 3) {
      return { error: `Write the change for ${m.name_as_written}, e.g. the new dose.` };
    }
    decisions.push({
      check_id: check.id,
      medication_id: m.id,
      decision: decision as Decision,
      note: note || null,
      decided_by: user.id,
    });
  }

  const { error } = await supabase.from("medication_decisions").insert(decisions);
  if (error) return { error: "Could not save your decisions. Please try again." };

  const stopped = decisions.filter((d) => d.decision === "stop").map((d) => d.medication_id);
  if (stopped.length) {
    await supabase.from("medications").update({ status: "stopped" }).in("id", stopped);
  }
  await supabase
    .from("reconciliation_checks")
    .update({ status: "reviewed", reviewed_at: new Date().toISOString() })
    .eq("id", check.id);

  const emailed = await emailPatientList(check.id);
  refresh();
  return emailed
    ? { success: "Saved. The patient can see the list in MedBridge and it was emailed to them." }
    : { success: "Saved. The patient can see the list in MedBridge. The email could not be sent." };
}

async function emailPatientList(checkId: string) {
  const admin = createAdminClient();
  const review = await loadReview(admin, checkId);
  if (!review) return false;
  const { data: patient } = await admin.from("profiles").select("email").eq("id", review.patientId).single();
  if (!patient?.email) return false;

  try {
    const calendar = buildCalendar(review.items.filter((i) => i.decision !== "stop"));
    const sent = await sendEmail({
      to: patient.email,
      subject: `Your medicine list from ${review.doctorName}`,
      html: reviewEmailHtml(review),
      attachments: [{ filename: "medbridge-medicines.ics", content: Buffer.from(calendar) }],
    });
    await admin.from("email_log").insert({
      patient_id: review.patientId,
      check_id: checkId,
      sent_to: patient.email,
      resend_id: sent?.id ?? null,
    });
    return true;
  } catch (err) {
    // The decisions are saved either way; the patient also sees them in the app.
    console.error("Patient list email failed", err);
    return false;
  }
}
