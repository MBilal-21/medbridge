import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { updateAppointment } from "@/app/actions/doctor";
import { AppointmentStatus } from "@/components/appointment-status";
import { DecisionBadge, Tag } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FlagAlert } from "@/components/ui/flag-alert";
import { CheckIcon, WarningIcon } from "@/components/ui/icons";
import {
  EmptyState,
  LoadingBlock,
  PageTitle,
  formatDate,
  formatDateTime,
} from "@/components/page-parts";
import { requireRole } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { findProblems, type NewFlag } from "@/lib/drugs";
import { loadReview } from "@/lib/review";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DecisionForm } from "./decision-form";
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
  const unconfirmed = medicines?.filter((m) => m.source === "photo_upload" && !m.decision) ?? [];

  // Problems already in the current list, before the doctor prescribes anything.
  // Only runs when RLS showed this doctor the list (the patient shared it).
  // Uses stored data only, so it is instant; saving a prescription runs the full check.
  const problems =
    !pending && medicines?.length
      ? (await findProblems(createAdminClient(), appointment.patient_id, { checkLabels: false })).flags
      : [];
  const problemsByMedicine = new Map<string, { text: string; severity: NewFlag["severity"] }[]>();
  for (const f of problems) {
    const [a, b] = f.medicines;
    const note = (other: string) =>
      f.type === "unclear"
        ? "Not in drug database"
        : f.type === "duplicate"
          ? `Same medicine as ${other}`
          : `Interacts with ${other}`;
    const add = (id: string | null, text: string) =>
      id && problemsByMedicine.set(id, [...(problemsByMedicine.get(id) ?? []), { text, severity: f.severity }]);
    add(f.medication_a_id, note(b));
    add(f.medication_b_id, note(a));
  }

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
          {open && (
            <Card>
              <CardHeader
                title="New prescription"
                description="Saving it checks the new medicines against everything the patient already takes."
              />
              <PrescriptionForm appointmentId={appointment.id} />
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
                {problems.some((f) => f.type !== "unclear") && (
                  <div className="mb-4 flex flex-col gap-3">
                    {problems
                      .filter((f) => f.type !== "unclear")
                      .map((f, i) => (
                        <FlagAlert
                          key={i}
                          type={f.type}
                          severity={f.severity}
                          title={
                            f.type === "duplicate"
                              ? `${f.medicines[0]} and ${f.medicines[1]} are the same medicine`
                              : `${f.medicines[0]} + ${f.medicines[1]}`
                          }
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
                          {m.source === "photo_upload" && !m.decision && (
                            <ProblemTag tone="moderate">Not reviewed by a doctor</ProblemTag>
                          )}
                          {problemsByMedicine.get(m.medication_id!)?.map((p) => (
                            <ProblemTag key={p.text} tone={p.severity}>
                              {p.text}
                            </ProblemTag>
                          ))}
                        </div>
                      </div>
                      {m.decision && <DecisionBadge decision={m.decision} />}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          {lastReviewed && <SentList checkId={lastReviewed.id} />}
        </>
      )}
    </>
  );
}

const problemTones = {
  high: "border-stop bg-stop-soft text-stop",
  moderate: "border-change bg-change-soft text-change",
  low: "border-border-strong bg-surface-muted text-muted",
} as const;

/** A problem on one medicine row. Icon + words, never colour alone. */
function ProblemTag({ tone, children }: { tone: keyof typeof problemTones; children: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium",
        problemTones[tone],
      )}
    >
      <WarningIcon className="size-3.5 shrink-0" />
      {children}
    </span>
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
  check: { id: string; new_prescription_id: string; medications_checked: number; duration_ms: number | null };
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
    supabase.from("medications").select("id").eq("prescription_id", check.new_prescription_id),
  ]);

  const sorted = (flags ?? []).sort((x, y) => severityOrder[x.severity] - severityOrder[y.severity]);
  const flagged = new Set(sorted.flatMap((f) => [f.medication_a_id, f.medication_b_id]));
  const newIds = new Set(newMeds?.map((m) => m.id));
  const nameOf = (m: { name_as_written: string; drug_products: { brand_name: string } | null } | null) =>
    m?.drug_products?.brand_name ?? m?.name_as_written ?? "Medicine";
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
          description="The patient receives exactly this list, marked STOP, CONTINUE, NEW and CHANGE."
        />
        <DecisionForm
          checkId={check.id}
          medicines={medicines.map((m) => ({
            id: m.medication_id!,
            name: m.brand_name ?? m.name_as_written ?? "Medicine",
            details: [m.dose, m.frequency, m.instructions].filter(Boolean).join(" · "),
            prescribedBy: m.prescribed_by,
            isNew: newIds.has(m.medication_id!),
            flagged: flagged.has(m.medication_id!),
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
    <Card>
      <CardHeader
        title="List sent to the patient"
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
