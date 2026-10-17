import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, LoadingBlock, PageTitle, formatDate } from "@/components/page-parts";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Patients" };

export default function PatientsPage() {
  return (
    <>
      <PageTitle
        title="Patients"
        description="Everyone signed up as a patient. Medicine details stay private to the patient and their doctors."
      />
      <Suspense fallback={<LoadingBlock lines={4} />}>
        <PatientList />
      </Suspense>
    </>
  );
}

async function PatientList() {
  await requireRole("admin");
  // Admins have no RLS access to medicines or appointments; only counts are read here,
  // with the service role, after the role check above.
  const admin = createAdminClient();
  const [{ data: patients }, { data: medicines }, { data: appointments }, { data: uploads }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id, full_name, email, phone, created_at")
        .eq("role", "patient")
        .order("created_at", { ascending: false }),
      admin.from("medications").select("patient_id").eq("status", "active"),
      admin.from("appointments").select("patient_id, status"),
      admin.from("prescription_uploads").select("patient_id"),
    ]);

  const count = <T extends { patient_id: string }>(rows: T[] | null, keep: (r: T) => boolean = () => true) => {
    const map = new Map<string, number>();
    for (const r of rows ?? []) if (keep(r)) map.set(r.patient_id, (map.get(r.patient_id) ?? 0) + 1);
    return map;
  };
  const activeMeds = count(medicines);
  const upcoming = count(appointments, (a) => a.status === "requested" || a.status === "confirmed");
  const totalAppointments = count(appointments, (a) => a.status !== "cancelled");
  const photos = count(uploads);

  return (
    <Card>
      <CardHeader title={`All patients (${patients?.length ?? 0})`} />
      {!patients?.length ? (
        <EmptyState title="No patients yet" />
      ) : (
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[640px] text-left">
            <thead className="border-b border-border text-sm text-muted">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">Patient</th>
                <th scope="col" className="py-2 pr-4 font-medium">Joined</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Active medicines</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Appointments</th>
                <th scope="col" className="py-2 text-right font-medium">Photos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {patients.map((p) => (
                <tr key={p.id}>
                  <td className="py-3 pr-4">
                    <p className="font-semibold">{p.full_name || "No name"}</p>
                    <p className="text-sm text-muted">
                      {p.email}
                      {p.phone && ` · ${p.phone}`}
                    </p>
                  </td>
                  <td className="tabular py-3 pr-4 text-sm">{formatDate(p.created_at)}</td>
                  <td className="tabular py-3 pr-4 text-right">{activeMeds.get(p.id) ?? 0}</td>
                  <td className="tabular py-3 pr-4 text-right">
                    {totalAppointments.get(p.id) ?? 0}
                    {(upcoming.get(p.id) ?? 0) > 0 && (
                      <span className="block text-sm text-muted">{upcoming.get(p.id)} upcoming</span>
                    )}
                  </td>
                  <td className="tabular py-3 text-right">{photos.get(p.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
