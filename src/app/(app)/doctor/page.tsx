import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { updateAppointment } from "@/app/actions/doctor";
import { AppointmentStatus } from "@/components/appointment-status";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, LoadingBlock, PageTitle, formatDateTime } from "@/components/page-parts";
import { requireRole, type CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Appointments" };

export default function DoctorHome() {
  return (
    <Suspense fallback={<LoadingBlock lines={4} />}>
      <DoctorDashboard />
    </Suspense>
  );
}

async function DoctorDashboard() {
  const user = await requireRole("doctor");
  if (user.doctorStatus !== "approved") return <VerificationStatus user={user} />;

  const supabase = await createClient();
  const [{ data: appointments }, { data: shares }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, scheduled_at, status, reason, share_history, profiles!appointments_patient_id_fkey(full_name)")
      .eq("doctor_id", user.id)
      .in("status", ["requested", "confirmed"])
      .order("scheduled_at"),
    supabase
      .from("history_shares")
      .select("patient_id, created_at, profiles(full_name)")
      .eq("doctor_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <>
      <PageTitle
        title={`Welcome, ${user.fullName || "Doctor"}`}
        description="Open an appointment to see the patient's full medicine list from every doctor."
      />
      <Card>
        <CardHeader title="Upcoming appointments" />
        {!appointments?.length ? (
          <EmptyState title="No upcoming appointments">
            Patients can book you now that your account is verified.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {appointments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">{a.profiles?.full_name || "Patient"}</p>
                  <p className="tabular text-sm text-muted">
                    {formatDateTime(a.scheduled_at)}
                    {a.reason && ` · ${a.reason}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <AppointmentStatus status={a.status} />
                  {a.status === "requested" && (
                    <form action={updateAppointment.bind(null, a.id, "confirm")}>
                      <button type="submit" className={buttonClasses("secondary")}>
                        Confirm
                      </button>
                    </form>
                  )}
                  <Link href={`/doctor/appointments/${a.id}`} className={buttonClasses("primary")}>
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Shared with you"
          description="Patients who gave you access to their full medicine history, without an appointment."
        />
        {!shares?.length ? (
          <EmptyState title="No patient has shared their history yet" />
        ) : (
          <ul className="divide-y divide-border">
            {shares.map((s) => (
              <li key={s.patient_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">{s.profiles?.full_name || "Patient"}</p>
                  <p className="tabular text-sm text-muted">Shared {formatDateTime(s.created_at)}</p>
                </div>
                <Link href={`/doctor/patients/${s.patient_id}`} className={buttonClasses("secondary")}>
                  View history
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function VerificationStatus({ user }: { user: CurrentUser }) {
  if (user.doctorStatus === "rejected") {
    return (
      <>
        <PageTitle title="Application not approved" />
        <Card className="max-w-2xl">
          <p>
            An admin could not verify your application. Check the reason, update your details and
            send it again.
          </p>
          <Link href="/doctor/apply" className={buttonClasses("primary", "md", "mt-4")}>
            Update application
          </Link>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageTitle title="Application received" />
      <Card className="max-w-2xl">
        <p className="font-semibold text-change">Waiting for verification</p>
        <p className="mt-1">
          An admin is checking your license. You will get an email when it is done. Until then,
          patients cannot book you and you cannot see any patient data.
        </p>
      </Card>
    </>
  );
}
