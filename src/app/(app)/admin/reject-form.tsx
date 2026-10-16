"use client";

import { useActionState, useState } from "react";
import { rejectDoctor } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form-parts";
import { emptyFormState } from "@/lib/form-state";

/** Reject needs a reason, so it opens a small form instead of acting on one click. */
export function RejectForm({ doctorId }: { doctorId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(rejectDoctor.bind(null, doctorId), emptyFormState);

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Reject…
      </Button>
    );
  }

  return (
    <form action={action} className="flex w-full flex-col gap-2 sm:max-w-md">
      <label htmlFor={`reason-${doctorId}`} className="font-medium">
        Reason for rejecting
      </label>
      <input
        id={`reason-${doctorId}`}
        name="reason"
        required
        minLength={5}
        autoFocus
        placeholder="License number not found in the PMDC register"
        className={inputClasses}
      />
      <FormMessage error={state.error} />
      <div className="flex gap-2">
        <SubmitButton variant="danger" pendingText="Rejecting…">
          Reject application
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
