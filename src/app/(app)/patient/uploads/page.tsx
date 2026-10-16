import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, LoadingBlock, PageTitle, formatDateTime } from "@/components/page-parts";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { cn } from "@/lib/cn";
import { UploadForm } from "./upload-form";

export const metadata: Metadata = { title: "Prescription photos" };

type UploadStatus = Database["public"]["Enums"]["upload_status"];

const statusText: Record<UploadStatus, { label: string; className: string }> = {
  uploaded: { label: "Waiting to be read", className: "bg-surface-muted text-muted" },
  processing: { label: "Reading…", className: "bg-new-soft text-new" },
  needs_confirmation: { label: "Check the medicines", className: "bg-change-soft text-change" },
  confirmed: { label: "Added to your list", className: "bg-continue-soft text-continue" },
  failed: { label: "Could not read", className: "bg-stop-soft text-stop" },
};

export default function UploadsPage() {
  return (
    <>
      <PageTitle
        title="Prescription photos"
        description="Add prescriptions from any doctor, even ones who don't use MedBridge."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Upload a photo"
            description="A clear photo of the whole prescription works best."
          />
          <UploadForm />
        </Card>
        <Suspense fallback={<LoadingBlock />}>
          <UploadList />
        </Suspense>
      </div>
    </>
  );
}

async function UploadList() {
  const user = await requireRole("patient");
  const supabase = await createClient();
  const { data: uploads } = await supabase
    .from("prescription_uploads")
    .select("id, status, created_at")
    .eq("patient_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <Card>
      <CardHeader title="Your uploads" />
      {!uploads?.length ? (
        <EmptyState title="No photos yet" />
      ) : (
        <ul className="divide-y divide-border">
          {uploads.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 py-3">
              <span className="tabular">{formatDateTime(u.created_at)}</span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-sm font-semibold",
                  statusText[u.status].className,
                )}
              >
                {statusText[u.status].label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
