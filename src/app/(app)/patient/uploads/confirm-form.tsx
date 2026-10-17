"use client";

import { useActionState } from "react";
import { confirmUpload } from "@/app/actions/patient";
import { inputClasses } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form-parts";
import { WarningIcon } from "@/components/ui/icons";
import { frequencies, type FrequencyValue } from "@/lib/frequencies";
import { emptyFormState } from "@/lib/form-state";

export type ReadMedicine = {
  name: string;
  strength: string;
  frequency: FrequencyValue;
  instructions: string;
  confidence: number;
};

/** The AI's reading of a photo, for the patient to correct before anything is added. */
export function ConfirmForm({
  uploadId,
  doctorName,
  prescribedOn,
  medicines,
}: {
  uploadId: string;
  doctorName: string;
  prescribedOn: string;
  medicines: ReadMedicine[];
}) {
  const [state, action] = useActionState(confirmUpload.bind(null, uploadId), emptyFormState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        We read these lines from your photo. Fix anything that is wrong and untick lines that are not medicines.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">Doctor</span>
          <input name="doctor_name" defaultValue={doctorName} className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">Date on prescription</span>
          <input name="prescribed_on" type="date" defaultValue={prescribedOn} className={inputClasses} />
        </label>
      </div>
      <ol className="flex flex-col gap-3">
        {medicines.map((m, i) => (
          <li key={i} className="rounded-control border border-border p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 font-semibold">
                <input type="checkbox" name="keep" value={i} defaultChecked className="size-5 accent-primary" />
                Add this medicine
              </label>
              {m.confidence < 0.7 && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-change">
                  <WarningIcon className="size-4" />
                  Hard to read, please check
                </span>
              )}
            </div>
            <input type="hidden" name="confidence" value={m.confidence} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="font-medium">Name</span>
                <input name="name" defaultValue={m.name} className={inputClasses} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-medium">Strength</span>
                <input name="strength" defaultValue={m.strength} className={inputClasses} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-medium">How often</span>
                <select name="frequency" defaultValue={m.frequency} className={inputClasses}>
                  {frequencies.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                      {f.times.length ? ` (${f.times.join(", ")})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-medium">Instructions</span>
                <input name="instructions" defaultValue={m.instructions} className={inputClasses} />
              </label>
            </div>
          </li>
        ))}
      </ol>
      <FormMessage error={state.error} success={state.success} />
      <SubmitButton pendingText="Adding…">Add to my medicine list</SubmitButton>
    </form>
  );
}
