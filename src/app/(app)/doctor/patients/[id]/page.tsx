import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CurrentMedicines } from "@/components/current-medicines";
import { CareTeam, HistoryTimeline } from "@/components/medicine-history";
import { LoadingBlock, PageTitle, formatDate } from "@/components/page-parts";
import { requireRole } from "@/lib/auth";
import { loadHistory } from "@/lib/history";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Patient history" };

export default function PatientHistoryPage({ params }: PageProps<"/doctor/patients/[id]">) {
  return (
    <>
      <Link href="/doctor" className="text-sm font-medium text-primary hover:underline">
        ← Back
      </Link>
      <Suspense fallback={<LoadingBlock lines={4} />}>
        <PatientHistory params={params} />
      </Suspense>
    </>
  );
}

async function PatientHistory({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole("doctor");
  if (user.doctorStatus !== "approved") redirect("/doctor");

  // RLS returns the patient only while they share their history with this doctor.
  const supabase = await createClient();
  const { data: patient } = await supabase
    .from("profiles")
    .select("id, full_name, date_of_birth")
    .eq("id", id)
    .eq("role", "patient")
    .maybeSingle();
  if (!patient) notFound();

  const [{ data: medicines }, history] = await Promise.all([
    supabase
      .from("patient_medication_list")
      .select("*")
      .eq("patient_id", patient.id)
      .eq("status", "active")
      .order("name_as_written"),
    loadHistory(supabase, patient.id),
  ]);

  return (
    <>
      <PageTitle
        title={patient.full_name || "Patient"}
        description={
          patient.date_of_birth
            ? `Born ${formatDate(patient.date_of_birth)} · Shared their medicine history with you`
            : "Shared their medicine history with you"
        }
      />
      <CurrentMedicines patientId={patient.id} medicines={medicines ?? []} />
      <CareTeam members={history.careTeam} viewer="doctor" />
      <HistoryTimeline events={history.events} viewer="doctor" />
    </>
  );
}
