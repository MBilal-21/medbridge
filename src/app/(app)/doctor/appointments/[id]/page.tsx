import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { updateAppointment } from "@/app/actions/doctor";
import { reviewCurrentList } from "@/app/actions/prescription";
import { SubmitButton } from "@/components/ui/form-parts";
import { AppointmentStatus } from "@/components/appointment-status";
import { DecisionBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FlagAlert } from "@/components/ui/flag-alert";
import { CheckIcon } from "@/components/ui/icons";
import {
  LoadingBlock,
  PageTitle,
  formatDate,
  formatDateTime,
} from "@/components/page-parts";
import { CurrentMedicines } from "@/components/current-medicines";
import { requireRole } from "@/lib/auth";
import { loadReview } from "@/lib/review";
import { createClient } from "@/lib/supabase/server";
import { DecisionForm, type DecisionMedicine } from "./decision-form";
import { PrescriptionForm } from "./prescription-form";

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

const severityOrder = { high: 0, moderate: 1, low: 2 } as const;

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
  const [{ data: medicines }, { data: checks }] = await Promise.all([
    supabase
      .from("patient_medication_list")
      .select("*")
      .eq("patient_id", appointment.patient_id)
      .eq("status", "active")
      .order("name_as_written"),
    supabase
      .from("reconciliation_checks")
      .select("id, status, new_prescription_id, medications_checked, duration_ms, created_at")
      .eq("appointment_id", appointment.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const pending = checks?.find((c) => c.status === "pending_review");
  const lastReviewed = checks?.find((c) => c.status === "reviewed");
  const open = appointment.status === "requested" || appointment.status === "confirmed";
  const patient = appointment.profiles;
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
            {appointment.status === "confirmed" && !pending && (
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

      {pending ? (
        <CheckReview check={pending} medicines={medicines ?? []} />
      ) : (
        <>
          {lastReviewed && <SentList checkId={lastReviewed.id} />}

          {open && (medicines?.length ?? 0) > 0 && (
            <Card className="border-primary">
              <CardHeader
                title="Review the current list"
                description="Check every medicine the patient takes, then mark each one STOP, CONTINUE or CHANGE. No new prescription needed."
                action={
                  <form action={reviewCurrentList.bind(null, appointment.id)}>
                    <SubmitButton pendingText="Checking…">Review list and decide</SubmitButton>
                  </form>
                }
              />
            </Card>
          )}

          {open && (
            <Card>
              <CardHeader
                title="New prescription"
                description="Saving it checks the new medicines against everything the patient already takes."
              />
              <PrescriptionForm appointmentId={appointment.id} />
            </Card>
          )}

          <CurrentMedicines
            patientId={appointment.patient_id}
            medicines={medicines ?? []}
            historyHref={`/doctor/patients/${appointment.patient_id}`}
          />

        </>
      )}
    </>
  );
}

type Medicine = {
  medication_id: string | null;
  name_as_written: string | null;
  brand_name: string | null;
  dose: string | null;
  frequency: string | null;
  instructions: string | null;
  prescribed_by: string | null;
};

async function CheckReview({
  check,
  medicines,
}: {
  check: { id: string; new_prescription_id: string | null; medications_checked: number; duration_ms: number | null };
  medicines: Medicine[];
}) {
  const supabase = await createClient();
  const [{ data: flags }, { data: newMeds }] = await Promise.all([
    supabase
      .from("check_flags")
      .select(
        "id, type, severity, finding, ai_explanation, source, medication_a_id, medication_b_id, a:medications!check_flags_medication_a_id_fkey(name_as_written, drug_products(brand_name)), b:medications!check_flags_medication_b_id_fkey(name_as_written, drug_products(brand_name))",
      )
      .eq("check_id", check.id),
    check.new_prescription_id
      ? supabase.from("medications").select("id").eq("prescription_id", check.new_prescription_id)
      : Promise.resolve({ data: [] as { id: string }[] }),
  ]);

  const sorted = (flags ?? []).sort((x, y) => severityOrder[x.severity] - severityOrder[y.severity]);
  const newIds = new Set(newMeds?.map((m) => m.id));
  const nameOf = (m: { name_as_written: string; drug_products: { brand_name: string } | null } | null) =>
    m?.drug_products?.brand_name ?? m?.name_as_written ?? "Medicine";
  // Each medicine's problems, worded for its row in the decision list.
  const problems = new Map<string, DecisionMedicine["problems"]>();
  const add = (id: string | null, text: string, severity: (typeof sorted)[number]["severity"]) =>
    id && problems.set(id, [...(problems.get(id) ?? []), { text, severity }]);
  for (const f of sorted) {
    const word = (other: string) =>
      f.type === "unclear" ? "Not in drug database" : f.type === "duplicate" ? `Same medicine as ${other}` : `Interacts with ${other}`;
    add(f.medication_a_id, word(nameOf(f.b)), f.severity);
    add(f.medication_b_id, word(nameOf(f.a)), f.severity);
  }
  const duplicates = sorted.filter((f) => f.type === "duplicate").length;
  const interactions = sorted.filter((f) => f.type === "interaction").length;

  return (
    <>
      <Card>
        <CardHeader
          title="Check results"
          description={
            <span className="tabular">
              {check.medications_checked} medicines checked
              {check.duration_ms !== null && ` in ${(check.duration_ms / 1000).toFixed(1)} s`} · {duplicates} duplicate
              {duplicates === 1 ? "" : "s"} · {interactions} interaction{interactions === 1 ? "" : "s"}
            </span>
          }
        />
        {!sorted.length ? (
          <p className="flex items-center gap-2 rounded-control bg-continue-soft px-3 py-2 font-medium text-continue">
            <CheckIcon className="size-5 shrink-0" />
            No duplicates or known interactions found.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {sorted.map((f) => (
              <FlagAlert
                key={f.id}
                type={f.type}
                severity={f.severity}
                title={
                  f.type === "unclear"
                    ? `${nameOf(f.a)} is not in the drug database`
                    : f.type === "duplicate"
                      ? `${nameOf(f.a)} and ${nameOf(f.b)} are the same medicine`
                      : `${nameOf(f.a)} + ${nameOf(f.b)}`
                }
                explanation={f.ai_explanation}
                source={f.source}
              >
                <p className="text-sm">
                  <span className="font-medium">Database finding: </span>
                  {f.finding}
                </p>
              </FlagAlert>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Your decision for each medicine"
          description="Medicines with a warning are listed first. The patient receives exactly this list, marked STOP, CONTINUE, NEW and CHANGE."
        />
        <DecisionForm
          checkId={check.id}
          medicines={medicines.map((m) => ({
            id: m.medication_id!,
            name: m.brand_name ?? m.name_as_written ?? "Medicine",
            details: [m.dose, m.frequency, m.instructions].filter(Boolean).join(" · "),
            prescribedBy: m.prescribed_by,
            isNew: newIds.has(m.medication_id!),
            problems: problems.get(m.medication_id!) ?? [],
          }))}
        />
      </Card>
    </>
  );
}

async function SentList({ checkId }: { checkId: string }) {
  const supabase = await createClient();
  const review = await loadReview(supabase, checkId);
  if (!review?.items.length) return null;
  return (
    <Card className="border-continue">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <CheckIcon className="size-5 text-continue" />
            List sent to the patient
          </span>
        }
        description={review.reviewedAt ? `Sent ${formatDateTime(review.reviewedAt)}` : undefined}
      />
      <ul className="divide-y divide-border">
        {review.items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
            <div>
              <p className="font-semibold">{i.name}</p>
              {i.note && <p className="text-sm text-muted">Note: {i.note}</p>}
            </div>
            <DecisionBadge decision={i.decision} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
