"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, requireUser } from "@/lib/auth";
import { formValues, type FormState } from "@/lib/form-state";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const applySchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name."),
  specialty: z.string().trim().min(2, "Enter your specialty."),
  clinic_name: z.string().trim().min(2, "Enter your clinic or hospital."),
  license_number: z.string().trim().min(3, "Enter your medical license (PMDC) number."),
});

/**
 * Sends (or re-sends, after a rejection) a doctor application. Runs with the
 * service role because users cannot change their own role or verification status.
 */
export async function applyAsDoctor(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = formValues(formData);
  if (user.role === "admin") return { error: "Admins cannot apply as doctors.", values };
  if (user.doctorStatus === "pending" || user.doctorStatus === "approved") redirect("/doctor");

  const parsed = applySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  const { full_name, specialty, clinic_name, license_number } = parsed.data;

  const admin = createAdminClient();
  const { error: profileError } = await admin
    .from("profiles")
    .update({ role: "doctor", full_name })
    .eq("id", user.id);
  if (profileError) return { error: "Could not send your application. Please try again.", values };

  const { error } = await admin.from("doctors").upsert({
    profile_id: user.id,
    specialty,
    clinic_name,
    license_number,
    verification_status: "pending",
    verified_by: null,
    verified_at: null,
    rejection_reason: null,
  });
  if (error) return { error: "Could not send your application. Please try again.", values };

  redirect("/doctor");
}

const nextStatus = { confirm: "confirmed", complete: "completed" } as const;

export async function updateAppointment(appointmentId: string, change: keyof typeof nextStatus) {
  const user = await requireRole("doctor");
  if (user.doctorStatus !== "approved") return;
  const supabase = await createClient();
  await supabase
    .from("appointments")
    .update({ status: nextStatus[change] })
    .eq("id", appointmentId)
    .eq("doctor_id", user.id);
  refresh();
}
