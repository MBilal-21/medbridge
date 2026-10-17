import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { cancelAppointment, setDoseReminders } from "@/app/actions/patient";
import { AppointmentStatus } from "@/components/appointment-status";
import { DecisionBadge, Tag } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { CalendarIcon, CameraIcon, StopIcon, WarningIcon } from "@/components/ui/icons";
import { EmptyState, LoadingBlock, PageTitle, formatDate, formatDateTime } from "@/components/page-parts";
import { requireRole } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { formatTime, nowInPakistan, slotFor, slotLabels } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "My medicines" };

type Medicine = Database["public"]["Views"]["patient_medication_list"]["Row"];

export default function PatientHome() {
  return (
    <>
      <PageTitle
        title="My medicines"
        description="Every medicine from every doctor, packed by the time you take it."
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

  const [{ data: medicines }, { data: appointments }, { data: profile }, { data: latestCheck }] =
    await Promise.all([
      supabase
        .from("patient_medication_list")
        .select("*")
        .eq("patient_id", user.id)
        .in("status", ["active", "stopped"])
        .order("name_as_written"),
      supabase
        .from("appointments")
        .select("id, scheduled_at, status, reason, doctors(specialty, profiles!doctors_profile_id_fkey(full_name))")
        .eq("patient_id", user.id)
        .order("scheduled_at", { ascending: false })
        .limit(10),
      supabase.from("profiles").select("dose_reminders").eq("id", user.id).single(),
      supabase
        .from("reconciliation_checks")
        .select("reviewed_at, doctors(profiles!doctors_profile_id_fkey(full_name))")
        .eq("patient_id", user.id)
        .eq("status", "reviewed")
        .order("reviewed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const active = medicines?.filter((m) => m.status === "active") ?? [];
  const stopped = (medicines?.filter((m) => m.status === "stopped") ?? []).sort((a, b) =>
    (b.decided_at ?? "").localeCompare(a.decided_at ?? ""),
  );

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

      <Card>
        <CardHeader
          title="Your medicine pack"
          description={
            latestCheck?.reviewed_at
              ? `Checked by ${latestCheck.doctors?.profiles?.full_name || "your doctor"} on ${formatDate(latestCheck.reviewed_at)}. Take each compartment at its time.`
              : "Take each compartment at its time. Times are set from how often each medicine is prescribed."
          }
          action={
            active.some((m) => m.dose_times?.length) && (
              <a href="/patient/calendar" download className={buttonClasses("secondary")}>
                <CalendarIcon className="size-5" />
                Add to calendar
              </a>
            )
          }
        />
        {!active.length ? (
          <EmptyState title="No medicines yet">Upload a photo of an old prescription, or book a doctor.</EmptyState>
        ) : (
          <>
            <Pack medicines={active} />
            <ReminderSetting enabled={profile?.dose_reminders ?? true} email={user.email} />
          </>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader
            title="Stopped medicines"
            description="Your doctor told you to stop these. Don't take them, even if you still have some at home."
          />
          {!stopped.length ? (
            <EmptyState title="Nothing stopped" />
          ) : (
            <ul className="divide-y divide-border">
              {stopped.map((m) => (
                <li key={m.medication_id} className="flex items-start gap-3 py-3">
                  <StopIcon className="mt-0.5 size-5 shrink-0 text-stop" />
                  <div>
                    <p className="font-semibold line-through decoration-stop/60">{m.brand_name ?? m.name_as_written}</p>
                    <p className="text-sm text-muted">
                      {[m.dose, m.decided_at && `Stopped ${formatDate(m.decided_at)}`].filter(Boolean).join(" · ")}
                    </p>
                    {m.decision_note && <p className="mt-0.5 text-sm">Doctor&apos;s note: {m.decision_note}</p>}
                  </div>
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

/** Compartments by dose time, like a weekly pill organiser, plus "when needed". */
function Pack({ medicines }: { medicines: Medicine[] }) {
  const byTime = new Map<string, Medicine[]>();
  for (const m of medicines) {
    for (const t of m.dose_times ?? []) {
      const time = t.slice(0, 5);
      byTime.set(time, [...(byTime.get(time) ?? []), m]);
    }
  }
  const times = [...byTime.keys()].sort();
  const now = nowInPakistan().time;
  const next = times.find((t) => t > now) ?? times[0];
  const asNeeded = medicines.filter((m) => !m.dose_times?.length);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {times.map((time) => (
        <section
          key={time}
          aria-label={`${slotLabels[slotFor(time)]}, ${formatTime(time)}`}
          className={cn(
            "flex flex-col rounded-card border-2 p-4",
            time === next ? "border-primary bg-primary-soft/40" : "border-border",
          )}
        >
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h3 className="font-semibold">{slotLabels[slotFor(time)]}</h3>
            <span className="tabular text-sm font-medium text-muted">
              {time === next && <span className="mr-1.5 text-primary">Next ·</span>}
              {formatTime(time)}
            </span>
          </div>
          <PackItems medicines={byTime.get(time)!} />
        </section>
      ))}
      {asNeeded.length > 0 && (
        <section aria-label="Only when needed" className="flex flex-col rounded-card border-2 border-dashed border-border-strong p-4">
          <div className="mb-3">
            <h3 className="font-semibold">Only when needed</h3>
            <p className="text-sm text-muted">No fixed time</p>
          </div>
          <PackItems medicines={asNeeded} />
        </section>
      )}
    </div>
  );
}

function PackItems({ medicines }: { medicines: Medicine[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {medicines.map((m) => (
        <li key={m.medication_id}>
          <p className="font-semibold">
            {m.brand_name ?? m.name_as_written}
            {m.dose && <span className="font-normal text-muted"> · {m.dose}</span>}
          </p>
          {m.instructions && <p className="text-sm text-muted">{m.instructions}</p>}
          {m.decision === "change" && m.decision_note && <p className="text-sm">Change: {m.decision_note}</p>}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(m.decision === "new" || m.decision === "change") && <DecisionBadge decision={m.decision} />}
            {!m.decision && m.source === "photo_upload" && (
              <span className="inline-flex items-center gap-1.5 text-sm text-change">
                <WarningIcon className="size-4" />
                Not checked by a doctor yet
              </span>
            )}
            {m.prescribed_by && <Tag>{m.prescribed_by}</Tag>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ReminderSetting({ enabled, email }: { enabled: boolean; email: string }) {
  return (
    <div
      id="reminders"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-control bg-surface-muted px-4 py-3"
    >
      <p className="text-sm">
        {enabled ? (
          <>
            <span className="font-semibold">Email reminders are on.</span> We email {email} at each dose time.
          </>
        ) : (
          <>
            <span className="font-semibold">Email reminders are off.</span> Turn them on to get an email at each dose
            time.
          </>
        )}
      </p>
      <form action={setDoseReminders.bind(null, !enabled)}>
        <button type="submit" className={buttonClasses(enabled ? "ghost" : "primary")}>
          {enabled ? "Turn off" : "Turn on reminders"}
        </button>
      </form>
    </div>
  );
}
