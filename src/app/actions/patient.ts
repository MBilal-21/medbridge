"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { formValues, type FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";

const bookSchema = z.object({
  doctor_id: z.uuid("Choose a doctor."),
  scheduled_at: z.iso.datetime({ offset: true, message: "Choose a date and time." }),
  reason: z.string().trim().max(500).optional(),
  share_history: z.literal("on", "You need to share your medicine history so the doctor can check it."),
});

export async function bookAppointment(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole("patient");
  const values = formValues(formData);
  const parsed = bookSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  const when = new Date(parsed.data.scheduled_at);
  if (when.getTime() < Date.now()) return { error: "Choose a time in the future.", values };

  const supabase = await createClient();
  const { error } = await supabase.from("appointments").insert({
    patient_id: user.id,
    doctor_id: parsed.data.doctor_id,
    scheduled_at: when.toISOString(),
    reason: parsed.data.reason || null,
    share_history: true,
  });
  if (error) return { error: "Could not book this appointment. Please try again.", values };

  refresh();
  return { success: "Appointment requested. The doctor will confirm it." };
}

export async function cancelAppointment(appointmentId: string) {
  const user = await requireRole("patient");
  const supabase = await createClient();
  await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId)
    .eq("patient_id", user.id)
    .in("status", ["requested", "confirmed"]);
  refresh();
}

const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
const maxBytes = 10 * 1024 * 1024;

export async function uploadPrescriptionPhoto(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireRole("patient");
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo to upload." };
  if (!allowedTypes.includes(file.type)) {
    return { error: "Upload a JPG, PNG, WEBP, HEIC photo or a PDF." };
  }
  if (file.size > maxBytes) return { error: "The file is larger than 10 MB." };

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const supabase = await createClient();
  const { error: storageError } = await supabase.storage
    .from("prescription-photos")
    .upload(path, file, { contentType: file.type });
  if (storageError) return { error: "Upload failed. Please try again." };

  const { error } = await supabase
    .from("prescription_uploads")
    .insert({ patient_id: user.id, storage_path: path });
  if (error) {
    await supabase.storage.from("prescription-photos").remove([path]);
    return { error: "Upload failed. Please try again." };
  }

  refresh();
  return { success: "Photo uploaded. We'll read the medicines from it for you to confirm." };
}
