import type { Metadata } from "next";
import { Suspense } from "react";
import { deleteUpload, retryUpload } from "@/app/actions/patient";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, LoadingBlock, PageTitle, formatDateTime } from "@/components/page-parts";
import type { PrescriptionReading } from "@/lib/ai";
import { requireRole } from "@/lib/auth";
import { frequencyForTimes } from "@/lib/frequencies";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { cn } from "@/lib/cn";
import { ConfirmForm } from "./confirm-form";
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
      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Card className="self-start">
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
    .select("id, status, created_at, storage_path, ai_raw_output")
    .eq("patient_id", user.id)
    .order("created_at", { ascending: false });

  const { data: signed } = uploads?.length
    ? await supabase.storage.from("prescription-photos").createSignedUrls(
        uploads.map((u) => u.storage_path),
        3600,
      )
    : { data: [] };
  const photoUrl = new Map(signed?.map((s) => [s.path, s.signedUrl]));

  return (
    <Card>
      <CardHeader title="Your uploads" />
      {!uploads?.length ? (
        <EmptyState title="No photos yet" />
      ) : (
        <ul className="divide-y divide-border">
          {uploads.map((u) => {
            const reading = u.ai_raw_output as PrescriptionReading | null;
            const url = photoUrl.get(u.storage_path);
            return (
              <li key={u.id} className="flex flex-col gap-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="tabular">{formatDateTime(u.created_at)}</span>
                    {url && (
                      <a href={url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">
                        View photo
                      </a>
                    )}
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-sm font-semibold",
                      statusText[u.status].className,
                    )}
                  >
                    {statusText[u.status].label}
                  </span>
                </div>

                {u.status === "needs_confirmation" && reading && (
                  <ConfirmForm
                    uploadId={u.id}
                    doctorName={reading.doctor_name ?? ""}
                    prescribedOn={reading.prescribed_on ?? ""}
                    medicines={reading.medicines.map((m) => ({
                      name: m.name,
                      strength: m.strength ?? "",
                      frequency: frequencyForTimes(m.dose_times),
                      instructions: [m.dose, m.instructions].filter(Boolean).join(", "),
                      confidence: m.confidence,
                    }))}
                  />
                )}

                {(u.status === "failed" || u.status === "uploaded" || u.status === "needs_confirmation") && (
                  <div className="flex flex-wrap gap-2">
                    {u.status !== "needs_confirmation" && (
                      <form action={retryUpload.bind(null, u.id)}>
                        <button type="submit" className={buttonClasses("secondary")}>
                          Try reading again
                        </button>
                      </form>
                    )}
                    <form action={deleteUpload.bind(null, u.id)}>
                      <button type="submit" className={buttonClasses("ghost", "md", "text-stop hover:bg-stop-soft")}>
                        Delete photo
                      </button>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
