import type { Metadata } from "next";
import { Suspense } from "react";
import { approveDoctor } from "@/app/actions/admin";
import { Tag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, LoadingBlock, PageTitle, formatDateTime } from "@/components/page-parts";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RejectForm } from "./reject-form";

export const metadata: Metadata = { title: "Doctor applications" };

export default function AdminHome() {
  return (
    <>
      <PageTitle
        title="Doctor applications"
        description="Check each license number before approving. Only approved doctors can see patient data."
      />
      <Suspense fallback={<LoadingBlock lines={4} />}>
        <Applications />
      </Suspense>
    </>
  );
}

async function Applications() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: doctors } = await supabase
    .from("doctors")
    .select(
      "profile_id, specialty, clinic_name, license_number, verification_status, verified_at, rejection_reason, created_at, profiles!doctors_profile_id_fkey(full_name, email)",
    )
    .order("created_at", { ascending: false });

  const pending = doctors?.filter((d) => d.verification_status === "pending") ?? [];
  const decided = doctors?.filter((d) => d.verification_status !== "pending") ?? [];

  return (
    <>
      <Card>
        <CardHeader
          title={`Waiting for review (${pending.length})`}
          description="Verify the license number with the PMDC register."
        />
        {!pending.length ? (
          <EmptyState title="No applications waiting" />
        ) : (
          <ul className="flex flex-col gap-4">
            {pending.map((d) => (
              <li key={d.profile_id} className="rounded-card border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{d.profiles?.full_name || "No name"}</p>
                    <p className="text-sm text-muted">{d.profiles?.email}</p>
                  </div>
                  <span className="tabular text-sm text-muted">
                    Applied {formatDateTime(d.created_at)}
                  </span>
                </div>
                <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-3">
                  <Detail label="License number" value={d.license_number} mono />
                  <Detail label="Specialty" value={d.specialty} />
                  <Detail label="Clinic" value={d.clinic_name} />
                </dl>
                <div className="mt-4 flex flex-wrap items-start gap-3">
                  <form action={approveDoctor.bind(null, d.profile_id)}>
                    <Button type="submit">Approve</Button>
                  </form>
                  <RejectForm doctorId={d.profile_id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Reviewed" />
        {!decided.length ? (
          <EmptyState title="Nothing reviewed yet" />
        ) : (
          <ul className="divide-y divide-border">
            {decided.map((d) => (
              <li key={d.profile_id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">{d.profiles?.full_name || "No name"}</p>
                  <p className="text-sm text-muted">
                    {d.specialty} · <span className="font-mono">{d.license_number}</span>
                  </p>
                  {d.rejection_reason && (
                    <p className="mt-1 text-sm text-stop">Reason: {d.rejection_reason}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {d.verification_status === "approved" ? (
                    <span className="rounded-full bg-continue-soft px-2.5 py-0.5 text-sm font-semibold text-continue">
                      Approved
                    </span>
                  ) : (
                    <span className="rounded-full bg-stop-soft px-2.5 py-0.5 text-sm font-semibold text-stop">
                      Rejected
                    </span>
                  )}
                  {d.verified_at && <Tag>{formatDateTime(d.verified_at)}</Tag>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Detail({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={mono ? "font-mono font-medium" : "font-medium"}>{value || "—"}</dd>
    </div>
  );
}
