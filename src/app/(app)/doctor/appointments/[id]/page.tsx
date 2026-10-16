import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { updateAppointment } from "@/app/actions/doctor";
import { AppointmentStatus } from "@/components/appointment-status";
import { DecisionBadge, Tag } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { WarningIcon } from "@/components/ui/icons";
import {
  EmptyState,
  LoadingBlock,
  PageTitle,
  formatDate,
  formatDateTime,
} from "@/components/page-parts";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Appointment" };

export default function AppointmentPage({ params }: PageProps<"/doctor/appointments/[id]">) {
  return (
    <>
      <Link href="/doctor" className="text-sm font-medium text-primary hover:underline">
        ← All appointments
      </Link>
      <Suspense fallback={<LoadingBlock lines={4} />}>
        <Appointment params={params} />
      </Suspense>
    </>
  );
}

async function Appointment({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole("doctor");
  if (user.doctorStatus !== "approved") redirect("/doctor");

  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, patient_id, scheduled_at, status, reason, profiles!appointments_patient_id_fkey(full_name, date_of_birth)")
    .eq("id", id)
    .eq("doctor_id", user.id)
    .maybeSingle();
  if (!appointment) notFound();

  // RLS only returns rows if the patient shared their history with this doctor.
  const { data: medicines } = await supabase
    .from("patient_medication_list")
    .select("*")
    .eq("patient_id", appointment.patient_id)
    .eq("status", "active")
    .order("name_as_written");

  const patient = appointment.profiles;
  const unconfirmed = medicines?.filter((m) => m.source === "photo_upload" && !m.decision) ?? [];

  return (
    <>
      <PageTitle
        title={patient?.full_name || "Patient"}
        description={
          <span className="tabular">
            {formatDateTime(appointment.scheduled_at)}
            {patient?.date_of_birth && ` · Born ${formatDate(patient.date_of_birth)}`}
          </span>
        }
        action={
          <div className="flex items-center gap-2">
            <AppointmentStatus status={appointment.status} />
            {appointment.status === "confirmed" && (
              <form action={updateAppointment.bind(null, appointment.id, "complete")}>
                <button type="submit" className={buttonClasses("secondary")}>
                  Mark completed
                </button>
              </form>
            )}
          </div>
        }
      />

      {appointment.reason && (
        <Card>
          <p className="text-sm font-medium text-muted">Reason for visit</p>
          <p className="mt-1">{appointment.reason}</p>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Full medicine list"
          description="Every active medicine from every doctor, including photos of outside prescriptions."
        />
        {!medicines?.length ? (
          <EmptyState title="No medicines on record">
            This patient has no active medicines yet.
          </EmptyState>
        ) : (
          <>
            {unconfirmed.length > 0 && (
              <p className="mb-3 flex items-center gap-2 rounded-control bg-change-soft px-3 py-2 text-sm font-medium text-change">
                <WarningIcon className="size-4 shrink-0" />
                {unconfirmed.length} medicine{unconfirmed.length > 1 ? "s" : ""} came from outside
                prescriptions and have not been reviewed by a MedBridge doctor.
              </p>
            )}
            <ul className="divide-y divide-border">
              {medicines.map((m) => (
                <li
                  key={m.medication_id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-semibold">{m.brand_name ?? m.name_as_written}</p>
                    <p className="tabular text-sm text-muted">
                      {[m.dose, m.frequency, m.instructions].filter(Boolean).join(" · ") ||
                        "No dose details"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Tag>{m.source === "photo_upload" ? "From photo" : "MedBridge"}</Tag>
                      {m.prescribed_by && <Tag>{m.prescribed_by}</Tag>}
                    </div>
                  </div>
                  {m.decision && <DecisionBadge decision={m.decision} />}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}
