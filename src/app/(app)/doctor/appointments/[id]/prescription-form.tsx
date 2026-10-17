"use client";

import { useActionState, useState } from "react";
import { createPrescription } from "@/app/actions/prescription";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form-parts";
import { PlusIcon } from "@/components/ui/icons";
import { frequencies } from "@/lib/frequencies";
import { emptyFormState } from "@/lib/form-state";

/** The doctor's new prescription. Submitting it runs the check on the patient's full list. */
export function PrescriptionForm({ appointmentId }: { appointmentId: string }) {
  const [state, action] = useActionState(createPrescription.bind(null, appointmentId), emptyFormState);
  const [rows, setRows] = useState([0]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <ol className="flex flex-col gap-4">
        {rows.map((key, i) => (
          <li key={key} className="rounded-control border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold">Medicine {i + 1}</p>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows((r) => r.filter((k) => k !== key))}
                  className="text-sm font-medium text-stop hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="font-medium">Name</span>
                <input name="name" required placeholder="Brufen" autoComplete="off" className={inputClasses} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-medium">Strength</span>
                <input name="strength" placeholder="400 mg" autoComplete="off" className={inputClasses} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-medium">How often</span>
                <select name="frequency" defaultValue="twice" className={inputClasses}>
                  {frequencies.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                      {f.times.length ? ` (${f.times.join(", ")})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-medium">For how many days</span>
                <input
                  name="days"
                  type="number"
                  min={1}
                  max={365}
                  inputMode="numeric"
                  placeholder="Leave empty if ongoing"
                  className={inputClasses}
                />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="font-medium">Instructions</span>
                <input name="instructions" placeholder="After meals" autoComplete="off" className={inputClasses} />
              </label>
            </div>
          </li>
        ))}
      </ol>
      <Button type="button" variant="ghost" className="self-start" onClick={() => setRows((r) => [...r, Math.max(...r) + 1])}>
        <PlusIcon className="size-5" />
        Add another medicine
      </Button>
      <FormMessage error={state.error} success={state.success} />
      <SubmitButton size="lg" pendingText="Checking the full list…">
        Save and check full list
      </SubmitButton>
    </form>
  );
}
