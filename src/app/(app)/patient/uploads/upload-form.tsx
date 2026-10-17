"use client";

import { useActionState, useState } from "react";
import { uploadPrescriptionPhoto } from "@/app/actions/patient";
import { CameraIcon } from "@/components/ui/icons";
import { FormMessage, SubmitButton } from "@/components/ui/form-parts";
import { emptyFormState } from "@/lib/form-state";

export function UploadForm() {
  const [state, action] = useActionState(uploadPrescriptionPhoto, emptyFormState);
  const [fileName, setFileName] = useState("");

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-card border-2 border-dashed border-border-strong p-8 text-center hover:bg-surface-muted has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring">
        <CameraIcon className="size-8 text-primary" />
        <span className="font-semibold">{fileName || "Take or choose a photo"}</span>
        <span className="text-sm text-muted">JPG, PNG or WEBP · up to 10 MB</span>
        <input
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp"
          required
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
        />
      </label>
      <FormMessage error={state.error} success={state.success} />
      <SubmitButton size="lg" pendingText="Uploading and reading…">
        Upload
      </SubmitButton>
    </form>
  );
}
