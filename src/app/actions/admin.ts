"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";
import { sendEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

async function notifyDoctor(doctorId: string, subject: string, html: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("email").eq("id", doctorId).single();
  if (!data?.email) return;
  try {
    await sendEmail({ to: data.email, subject, html });
  } catch (err) {
    // The decision is saved either way; a failed email must not undo it.
    console.error("Doctor notification email failed", err);
  }
}

export async function approveDoctor(doctorId: string) {
  const user = await requireRole("admin");
  const admin = createAdminClient();
  const { data } = await admin
    .from("doctors")
    .update({
      verification_status: "approved",
      verified_by: user.id,
      verified_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq("profile_id", doctorId)
    .select("profile_id")
    .maybeSingle();

  if (data) {
    await notifyDoctor(
      doctorId,
      "Your MedBridge doctor account is approved",
      "<p>Your license has been verified. Patients can now book appointments with you on MedBridge.</p>",
    );
  }
  refresh();
}

const rejectSchema = z.object({
  reason: z.string().trim().min(5, "Give the doctor a reason (at least 5 characters)."),
});

export async function rejectDoctor(
  doctorId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireRole("admin");
  const parsed = rejectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { error } = await admin
    .from("doctors")
    .update({
      verification_status: "rejected",
      verified_by: user.id,
      verified_at: new Date().toISOString(),
      rejection_reason: parsed.data.reason,
    })
    .eq("profile_id", doctorId);
  if (error) return { error: "Could not save. Please try again." };

  const reason = parsed.data.reason.replace(/[<>&]/g, "");
  await notifyDoctor(
    doctorId,
    "Your MedBridge doctor application needs changes",
    `<p>We could not verify your application.</p><p><strong>Reason:</strong> ${reason}</p><p>Sign in to MedBridge to update and resend it.</p>`,
  );
  refresh();
  return { success: "Application rejected." };
}
