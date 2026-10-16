import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState, LoadingBlock, PageTitle } from "@/components/page-parts";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BookingForm } from "./booking-form";

export const metadata: Metadata = { title: "Book appointment" };

export default function BookPage() {
  return (
    <>
      <PageTitle
        title="Book an appointment"
        description="All doctors listed here have been verified by MedBridge."
      />
      <Suspense fallback={<LoadingBlock />}>
        <Booking />
      </Suspense>
    </>
  );
}

async function Booking() {
  await requireRole("patient");
  const supabase = await createClient();
  const { data: doctors } = await supabase
    .from("doctors")
    .select("profile_id, specialty, clinic_name, profiles!doctors_profile_id_fkey(full_name)")
    .eq("verification_status", "approved")
    .order("specialty");

  if (!doctors?.length) {
    return (
      <EmptyState title="No verified doctors yet">
        Doctors appear here once an admin has verified their license.
      </EmptyState>
    );
  }

  return (
    <Card className="max-w-2xl">
      <BookingForm
        doctors={doctors.map((d) => ({
          id: d.profile_id,
          name: d.profiles?.full_name || "Doctor",
          specialty: d.specialty,
          clinic: d.clinic_name,
        }))}
      />
    </Card>
  );
}
