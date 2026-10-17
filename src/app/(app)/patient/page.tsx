import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { cancelAppointment } from "@/app/actions/patient";
import { DecisionBadge, Tag } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { CalendarIcon, CameraIcon, WarningIcon } from "@/components/ui/icons";
import { EmptyState, LoadingBlock, PageTitle, formatDateTime } from "@/components/page-parts";
import { requireRole } from "@/lib/auth";
import { decisionOrder, loadReview } from "@/lib/review";
import { createClient } from "@/lib/supabase/server";
import { AppointmentStatus } from "@/components/appointment-status";

export const metadata: Metadata = { title: "My medicines" };

export default function PatientHome() {
  return (
    <>
      <PageTitle
        title="My medicines"
        description="Every medicine from every doctor, in one list."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/patient/uploads" className={buttonClasses("secondary")}>
              <CameraIcon className="size-5" />
              Add prescription photo
            </Link>
            <Link href="/patient/book" className={buttonClasses("primary")}>
              Book appointment
            </Link>
          </div>
        }
      />
      <Suspense fallback={<LoadingBlock lines={4} />}>
        <PatientDashboard />
      </Suspense>
    </>
  );
}

async function PatientDashboard() {
  const user = await requireRole("patient");
  const supabase = await createClient();

  const [{ data: medicines }, { data: appointments }, { data: latestCheck }] = await Promise.all([
    supabase
      .from("patient_medication_list")
      .select("*")
      .eq("patient_id", user.id)
      .eq("status", "active")
      .order("name_as_written"),
    supabase
      .from("appointments")
      .select("id, scheduled_at, status, reason, doctors(specialty, profiles!doctors_profile_id_fkey(full_name))")
      .eq("patient_id", user.id)
      .order("scheduled_at", { ascending: false })
      .limit(10),
    supabase
      .from("reconciliation_checks")
      .select("id")
      .eq("patient_id", user.id)
      .eq("status", "reviewed")
      .order("reviewed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const review = latestCheck ? await loadReview(supabase, latestCheck.id) : null;

  return (
    <>
      {user.needsDoctorApplication && (
        <Card className="border-change bg-change-soft">
          <p className="font-semibold text-change">Finish your doctor application</p>
          <p className="mt-1">You signed up as a doctor. Send your license details so an admin can verify you.</p>
          <Link href="/doctor/apply" className={buttonClasses("primary", "md", "mt-3")}>
            Apply as a doctor
          </Link>
        </Card>
      )}

      {review && review.items.length > 0 && (
        <Card>
          <CardHeader
            title={`Your list from ${review.doctorName}`}
            description={review.reviewedAt ? `Checked ${formatDateTime(review.reviewedAt)}. Follow this list.` : undefined}
            action={
              <a href="/patient/calendar" download className={buttonClasses("secondary")}>
                <CalendarIcon className="size-5" />
                Add to calendar
              </a>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {decisionOrder.map((d) => {
              const items = review.items.filter((i) => i.decision === d);
              if (!items.length) return null;
              return (
                <div key={d} className="rounded-control border border-border p-4">
                  <DecisionBadge decision={d} />
                  <ul className="mt-3 flex flex-col gap-3">
                    {items.map((i) => (
                      <li key={i.id}>
                        <p className="font-semibold">{i.name}</p>
                        {d !== "stop" && (
                          <p className="tabular text-sm text-muted">
                            {[i.dose, i.frequency, i.dose_times.map((t) => t.slice(0, 5)).join(", "), i.instructions]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                        {i.note && <p className="text-sm">Doctor&apos;s note: {i.note}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader
            title="Current medicines"
            description="Decisions are made by your doctor after checking the full list."
          />
          {!medicines?.length ? (
            <EmptyState title="No medicines yet">
              Upload a photo of an old prescription, or book a doctor.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {medicines.map((m) => (
                <li key={m.medication_id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">{m.brand_name ?? m.name_as_written}</p>
                    <p className="tabular text-sm text-muted">
                      {[m.dose, m.frequency, m.dose_times?.map((t) => t.slice(0, 5)).join(", ")]
                        .filter(Boolean)
                        .join(" · ") || "No dose details"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Tag>{m.source === "photo_upload" ? "From photo" : "MedBridge doctor"}</Tag>
                      {m.prescribed_by && <Tag>{m.prescribed_by}</Tag>}
                    </div>
                  </div>
                  {m.decision ? (
                    <DecisionBadge decision={m.decision} />
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                      <WarningIcon className="size-4" />
                      Not reviewed yet
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Appointments" />
          {!appointments?.length ? (
            <EmptyState title="No appointments">
              <Link href="/patient/book" className="font-medium text-primary hover:underline">
                Book your first appointment
              </Link>
            </EmptyState>
          ) : (
            <ul className="flex flex-col gap-3">
              {appointments.map((a) => (
                <li key={a.id} className="rounded-control border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{a.doctors?.profiles?.full_name || "Doctor"}</p>
                      <p className="text-sm text-muted">{a.doctors?.specialty}</p>
                    </div>
                    <AppointmentStatus status={a.status} />
                  </div>
                  <p className="tabular mt-2 text-sm">{formatDateTime(a.scheduled_at)}</p>
                  {(a.status === "requested" || a.status === "confirmed") && (
                    <form action={cancelAppointment.bind(null, a.id)} className="mt-2">
                      <button type="submit" className="text-sm font-medium text-stop hover:underline">
                        Cancel appointment
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
