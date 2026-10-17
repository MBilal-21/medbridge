import Link from "next/link";
import { DecisionBadge, Tag } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FlagAlert } from "@/components/ui/flag-alert";
import { WarningIcon } from "@/components/ui/icons";
import { EmptyState } from "@/components/page-parts";
import { cn } from "@/lib/cn";
import { findProblems, type NewFlag } from "@/lib/drugs";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type Medicine = Database["public"]["Views"]["patient_medication_list"]["Row"];

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

/**
 * The doctor's view of a patient's active medicines, with the problems already
 * in the list. `medicines` must come from the doctor's own (RLS) client, which
 * proves the patient shared their history; the quick check then uses stored
 * drug data only, so it is instant. Saving a prescription runs the full check.
 */
export async function CurrentMedicines({
  patientId,
  medicines,
  historyHref,
}: {
  patientId: string;
  medicines: Medicine[];
  historyHref?: string;
}) {
  const problems = medicines.length
    ? (await findProblems(createAdminClient(), patientId, { checkLabels: false })).flags
    : [];
  const byMedicine = new Map<string, { text: string; severity: NewFlag["severity"] }[]>();
  for (const f of problems) {
    const [a, b] = f.medicines;
    const note = (other: string) =>
      f.type === "unclear"
        ? "Not in drug database"
        : f.type === "duplicate"
          ? `Same medicine as ${other}`
          : `Interacts with ${other}`;
    const add = (id: string | null, text: string) =>
      id && byMedicine.set(id, [...(byMedicine.get(id) ?? []), { text, severity: f.severity }]);
    add(f.medication_a_id, note(b));
    add(f.medication_b_id, note(a));
  }
  const unconfirmed = medicines.filter((m) => m.source === "photo_upload" && !m.decision);
  const clashes = problems.filter((f) => f.type !== "unclear");

  return (
    <Card>
      <CardHeader
        title="Full medicine list"
        description="Every active medicine from every doctor, including photos of outside prescriptions."
        action={
          historyHref && (
            <Link href={historyHref} className={buttonClasses("secondary")}>
              Full history
            </Link>
          )
        }
      />
      {!medicines.length ? (
        <EmptyState title="No medicines on record">This patient has no active medicines yet.</EmptyState>
      ) : (
        <>
          {clashes.length > 0 && (
            <div className="mb-4 flex flex-col gap-3">
              {clashes.map((f, i) => (
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
              {unconfirmed.length} medicine{unconfirmed.length > 1 ? "s" : ""} came from outside prescriptions and
              have not been reviewed by a MedBridge doctor.
            </p>
          )}
          <ul className="divide-y divide-border">
            {medicines.map((m) => (
              <li key={m.medication_id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">{m.brand_name ?? m.name_as_written}</p>
                  <p className="tabular text-sm text-muted">
                    {[m.dose, m.frequency, m.instructions].filter(Boolean).join(" · ") || "No dose details"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Tag>{m.source === "photo_upload" ? "From photo" : "MedBridge"}</Tag>
                    {m.prescribed_by && <Tag>{m.prescribed_by}</Tag>}
                    {m.source === "photo_upload" && !m.decision && (
                      <ProblemTag tone="moderate">Not reviewed by a doctor</ProblemTag>
                    )}
                    {byMedicine.get(m.medication_id!)?.map((p) => (
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
  );
}
