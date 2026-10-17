import type { Metadata } from "next";
import { Suspense } from "react";
import { stopSharing } from "@/app/actions/patient";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { CheckIcon, InfoIcon } from "@/components/ui/icons";
import { EmptyState, LoadingBlock, PageTitle, formatDate } from "@/components/page-parts";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MedicineTabs } from "../medicine-tabs";
import { ShareForm } from "./share-form";

export const metadata: Metadata = { title: "Sharing" };

export default function SharingPage() {
  return (
    <>
      <PageTitle title="My medicines" description="You decide which doctors can see your medicine history." />
      <MedicineTabs active="sharing" />
      <Suspense fallback={<LoadingBlock lines={3} />}>
        <Sharing />
      </Suspense>
    </>
  );
}

type Access = { id: string; name: string; specialty: string; reasons: string[] };

async function Sharing() {
  const user = await requireRole("patient");
  const supabase = await createClient();
  const [{ data: shares }, { data: appointments }, { data: doctors }] = await Promise.all([
    supabase
      .from("history_shares")
      .select("doctor_id, created_at, doctors(specialty, profiles!doctors_profile_id_fkey(full_name))")
      .eq("patient_id", user.id),
    supabase
      .from("appointments")
      .select("doctor_id, scheduled_at, doctors(specialty, verification_status, profiles!doctors_profile_id_fkey(full_name))")
      .eq("patient_id", user.id)
      .eq("share_history", true)
      .neq("status", "cancelled")
      .order("scheduled_at"),
    supabase
      .from("doctors")
      .select("profile_id, specialty, profiles!doctors_profile_id_fkey(full_name)")
      .eq("verification_status", "approved"),
  ]);

  const access = new Map<string, Access>();
  const add = (id: string, name: string, specialty: string, reason: string) => {
    const entry = access.get(id) ?? { id, name, specialty, reasons: [] };
    entry.reasons.push(reason);
    access.set(id, entry);
  };
  for (const s of shares ?? []) {
    add(s.doctor_id, s.doctors?.profiles?.full_name || "Doctor", s.doctors?.specialty ?? "", `You shared on ${formatDate(s.created_at)}`);
  }
  for (const a of appointments ?? []) {
    if (a.doctors?.verification_status !== "approved") continue;
    add(a.doctor_id, a.doctors.profiles?.full_name || "Doctor", a.doctors.specialty, `Your appointment on ${formatDate(a.scheduled_at)}`);
  }
  const withAccess = [...access.values()].sort((a, b) => a.name.localeCompare(b.name));
  const others = (doctors ?? [])
    .filter((d) => !access.has(d.profile_id))
    .map((d) => ({ id: d.profile_id, label: `${d.profiles?.full_name || "Doctor"} · ${d.specialty}` }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <Card>
        <CardHeader
          title={`Doctors who can see your history (${withAccess.length})`}
          description="They see every medicine you take, your prescription photos and other doctors' decisions."
        />
        {!withAccess.length ? (
          <EmptyState title="No doctor can see your history">
            Share it with a doctor, or book an appointment.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {withAccess.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex items-start gap-3">
                  <CheckIcon className="mt-0.5 size-5 shrink-0 text-continue" />
                  <div>
                    <p className="font-semibold">{d.name}</p>
                    <p className="text-sm text-muted">{d.specialty}</p>
                    <p className="mt-0.5 text-sm">{d.reasons.join(" · ")}</p>
                  </div>
                </div>
                <form action={stopSharing.bind(null, d.id)}>
                  <button type="submit" className={buttonClasses("secondary")}>
                    Stop sharing
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader
            title="Share with a doctor"
            description="Any MedBridge doctor, anytime. You don't need an appointment."
          />
          {others.length ? (
            <ShareForm doctors={others} />
          ) : (
            <p className="text-muted">Every MedBridge doctor can already see your history.</p>
          )}
        </Card>
        <p className="flex gap-2 text-sm text-muted">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          Booking an appointment also shares your history with that doctor. &ldquo;Stop sharing&rdquo; removes their
          access completely, including through appointments.
        </p>
      </div>
    </div>
  );
}
