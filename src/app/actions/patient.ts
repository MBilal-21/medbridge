"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { readPrescriptionPhoto } from "@/lib/ai";
import { requireRole } from "@/lib/auth";
import { matchProduct } from "@/lib/drugs";
import { formValues, type FormState } from "@/lib/form-state";
import { frequencyByValue } from "@/lib/frequencies";
import { createAdminClient } from "@/lib/supabase/admin";
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

// The AI reads these image types. HEIC and PDF are not readable, so they are not accepted.
const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
const maxBytes = 10 * 1024 * 1024;

export async function uploadPrescriptionPhoto(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireRole("patient");
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo to upload." };
  if (!allowedTypes.includes(file.type)) {
    return { error: "Upload a JPG, PNG or WEBP photo." };
  }
  if (file.size > maxBytes) return { error: "The file is larger than 10 MB." };

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const supabase = await createClient();
  const { error: storageError } = await supabase.storage
    .from("prescription-photos")
    .upload(path, file, { contentType: file.type });
  if (storageError) return { error: "Upload failed. Please try again." };

  const { data: upload, error } = await supabase
    .from("prescription_uploads")
    .insert({ patient_id: user.id, storage_path: path })
    .select("id")
    .single();
  if (error || !upload) {
    await supabase.storage.from("prescription-photos").remove([path]);
    return { error: "Upload failed. Please try again." };
  }

  const read = await readUpload(upload.id);
  refresh();
  return read
    ? { success: "Photo read. Check the medicines below, then add them to your list." }
    : { error: "Photo saved, but we could not read it. Try again, or upload a clearer photo." };
}

/** AI reads the photo into medicine lines for the patient to check. Nothing is added to the list yet. */
async function readUpload(uploadId: string) {
  const supabase = await createClient();
  const { data: upload } = await supabase
    .from("prescription_uploads")
    .select("id, storage_path")
    .eq("id", uploadId)
    .single();
  if (!upload) return false;
  await supabase.from("prescription_uploads").update({ status: "processing", error: null }).eq("id", upload.id);

  const { data: signed } = await supabase.storage
    .from("prescription-photos")
    .createSignedUrl(upload.storage_path, 300);
  try {
    if (!signed) throw new Error("Could not open the photo");
    const reading = await readPrescriptionPhoto(signed.signedUrl);
    if (!reading.medicines.length) throw new Error("No medicines found on the photo");
    await supabase
      .from("prescription_uploads")
      .update({ status: "needs_confirmation", ai_raw_output: reading })
      .eq("id", upload.id);
    return true;
  } catch (err) {
    console.error("Prescription photo reading failed", err);
    await supabase
      .from("prescription_uploads")
      .update({ status: "failed", error: err instanceof Error ? err.message : "Could not read" })
      .eq("id", upload.id);
    return false;
  }
}

export async function retryUpload(uploadId: string) {
  await requireRole("patient");
  await readUpload(uploadId);
  refresh();
}

const confirmedSchema = z.object({
  name: z.string().trim().min(2, "Enter the medicine name."),
  strength: z.string().trim().max(40),
  frequency: z.string().refine((v) => !!frequencyByValue(v), "Choose how often you take it."),
  instructions: z.string().trim().max(200),
  confidence: z.coerce.number().min(0).max(1).catch(0.5),
});

/**
 * Adds the medicines the patient checked to their list. The patient corrects
 * anything the AI read wrongly and removes lines that are not medicines.
 */
export async function confirmUpload(uploadId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole("patient");
  const supabase = await createClient();
  const { data: upload } = await supabase
    .from("prescription_uploads")
    .select("id")
    .eq("id", uploadId)
    .eq("patient_id", user.id)
    .eq("status", "needs_confirmation")
    .maybeSingle();
  if (!upload) return { error: "These medicines were already added." };

  const column = (key: string) => formData.getAll(key).map(String);
  const keep = new Set(column("keep"));
  const medicines = [];
  for (const [i, name] of column("name").entries()) {
    if (!keep.has(String(i))) continue;
    const parsed = confirmedSchema.safeParse({
      name,
      strength: column("strength")[i] ?? "",
      frequency: column("frequency")[i] ?? "",
      instructions: column("instructions")[i] ?? "",
      confidence: column("confidence")[i] ?? "",
    });
    if (!parsed.success) return { error: `Line ${i + 1}: ${parsed.error.issues[0].message}` };
    medicines.push(parsed.data);
  }
  if (!medicines.length) return { error: "Keep at least one medicine, or delete this photo." };

  const prescribedOn = String(formData.get("prescribed_on") ?? "");
  const { data: prescription, error } = await supabase
    .from("prescriptions")
    .insert({
      patient_id: user.id,
      source: "photo_upload",
      upload_id: upload.id,
      external_doctor_name: String(formData.get("doctor_name") ?? "").trim() || null,
      prescribed_on: /^\d{4}-\d{2}-\d{2}$/.test(prescribedOn) ? prescribedOn : null,
    })
    .select("id")
    .single();
  if (error || !prescription) return { error: "Could not save. Please try again." };

  const admin = createAdminClient();
  const productIds = await Promise.all(medicines.map((m) => matchProduct(admin, m.name, m.strength)));
  const { error: medError } = await supabase.from("medications").insert(
    medicines.map((m, i) => {
      const frequency = frequencyByValue(m.frequency)!;
      return {
        patient_id: user.id,
        prescription_id: prescription.id,
        drug_product_id: productIds[i],
        name_as_written: m.name,
        dose: m.strength || null,
        frequency: frequency.label,
        dose_times: [...frequency.times],
        instructions: m.instructions || null,
        ai_confidence: m.confidence,
        patient_confirmed: true,
      };
    }),
  );
  if (medError) {
    await admin.from("prescriptions").delete().eq("id", prescription.id);
    return { error: "Could not save. Please try again." };
  }

  await supabase.from("prescription_uploads").update({ status: "confirmed" }).eq("id", upload.id);
  refresh();
  return { success: `${medicines.length} medicine${medicines.length > 1 ? "s" : ""} added to your list.` };
}

export async function deleteUpload(uploadId: string) {
  const user = await requireRole("patient");
  const supabase = await createClient();
  const { data: upload } = await supabase
    .from("prescription_uploads")
    .delete()
    .eq("id", uploadId)
    .eq("patient_id", user.id)
    .neq("status", "confirmed")
    .select("storage_path")
    .maybeSingle();
  if (upload) await supabase.storage.from("prescription-photos").remove([upload.storage_path]);
  refresh();
}

export async function setDoseReminders(enabled: boolean) {
  const user = await requireRole("patient");
  const supabase = await createClient();
  await supabase.from("profiles").update({ dose_reminders: enabled }).eq("id", user.id);
  refresh();
}

/** Lets a doctor see the patient's full medicine history, without an appointment. */
export async function shareHistory(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole("patient");
  const parsed = z.uuid().safeParse(formData.get("doctor_id"));
  if (!parsed.success) return { error: "Choose a doctor." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("history_shares")
    .insert({ patient_id: user.id, doctor_id: parsed.data });
  // 23505: already shared with this doctor, which is what the patient wanted.
  if (error && error.code !== "23505") return { error: "Could not share. Please try again." };

  refresh();
  return { success: "Shared. The doctor can now see your medicine history." };
}

/** Removes a doctor's access, both the direct share and through appointments. */
export async function stopSharing(doctorId: string) {
  const user = await requireRole("patient");
  const supabase = await createClient();
  await Promise.all([
    supabase.from("history_shares").delete().eq("patient_id", user.id).eq("doctor_id", doctorId),
    supabase
      .from("appointments")
      .update({ share_history: false })
      .eq("patient_id", user.id)
      .eq("doctor_id", doctorId),
  ]);
  refresh();
}
