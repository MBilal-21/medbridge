"use client";

import { useActionState } from "react";
import { shareHistory } from "@/app/actions/patient";
import { inputClasses } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form-parts";
import { emptyFormState } from "@/lib/form-state";

export function ShareForm({ doctors }: { doctors: { id: string; label: string }[] }) {
  const [state, action] = useActionState(shareHistory, emptyFormState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">Doctor</span>
        <select name="doctor_id" required defaultValue="" className={inputClasses}>
          <option value="" disabled>
            Choose a doctor
          </option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </label>
      <FormMessage error={state.error} success={state.success} />
      <SubmitButton className="self-start" pendingText="Sharing…">
        Share my history
      </SubmitButton>
    </form>
  );
}
