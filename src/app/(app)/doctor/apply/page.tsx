import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { LoadingBlock, PageTitle } from "@/components/page-parts";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ApplyForm } from "./apply-form";

export const metadata: Metadata = { title: "Apply as a doctor" };

export default function ApplyPage() {
  return (
    <>
      <PageTitle
        title="Apply as a doctor"
        description="An admin checks your license before you can see any patient data."
      />
      <Suspense fallback={<LoadingBlock />}>
        <Application />
      </Suspense>
    </>
  );
}

async function Application() {
  const user = await requireUser();
  if (user.role === "admin") redirect("/admin");
  if (user.doctorStatus === "pending" || user.doctorStatus === "approved") redirect("/doctor");

  // A rejected doctor resubmits with their previous details filled in.
  const supabase = await createClient();
  const { data: previous } = await supabase
    .from("doctors")
    .select("specialty, clinic_name, license_number, rejection_reason")
    .eq("profile_id", user.id)
    .maybeSingle();

  return (
    <Card className="max-w-2xl">
      {previous?.rejection_reason && (
        <p className="mb-5 rounded-control bg-stop-soft p-3 text-stop">
          <span className="font-semibold">Previous application rejected: </span>
          {previous.rejection_reason}
        </p>
      )}
      <ApplyForm
        defaults={{
          full_name: user.fullName,
          specialty: previous?.specialty ?? "",
          clinic_name: previous?.clinic_name ?? "",
          license_number: previous?.license_number ?? "",
        }}
      />
    </Card>
  );
}
