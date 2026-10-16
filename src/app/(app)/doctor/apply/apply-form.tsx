"use client";

import { useActionState } from "react";
import { applyAsDoctor } from "@/app/actions/doctor";
import { Field } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form-parts";
import { emptyFormState } from "@/lib/form-state";

type Defaults = { full_name: string; specialty: string; clinic_name: string; license_number: string };

export function ApplyForm({ defaults }: { defaults: Defaults }) {
  const [state, action] = useActionState(applyAsDoctor, emptyFormState);
  const value = (key: keyof Defaults) => state.values?.[key] ?? defaults[key];

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" name="full_name" required defaultValue={value("full_name")} />
      <Field
        label="Specialty"
        name="specialty"
        required
        placeholder="General Practice"
        defaultValue={value("specialty")}
      />
      <Field
        label="Clinic or hospital"
        name="clinic_name"
        required
        defaultValue={value("clinic_name")}
      />
      <Field
        label="License number"
        name="license_number"
        required
        hint="Your PMDC registration number."
        defaultValue={value("license_number")}
      />
      <div className="flex flex-col gap-4 sm:col-span-2">
        <FormMessage error={state.error} />
        <SubmitButton size="lg" pendingText="Sending…">
          Send application
        </SubmitButton>
      </div>
    </form>
  );
}
