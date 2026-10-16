"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { bookAppointment } from "@/app/actions/patient";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form-parts";
import { emptyFormState } from "@/lib/form-state";
import { cn } from "@/lib/cn";

type Doctor = { id: string; name: string; specialty: string; clinic: string | null };

export function BookingForm({ doctors }: { doctors: Doctor[] }) {
  const [state, action] = useActionState(bookAppointment, emptyFormState);
  // datetime-local has no time zone; send the browser's exact moment instead.
  const [scheduledAt, setScheduledAt] = useState("");

  if (state.success) {
    return (
      <div className="flex flex-col items-start gap-4">
        <FormMessage success={state.success} />
        <Link href="/patient" className={buttonClasses("primary")}>
          Back to my medicines
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 font-medium">Doctor</legend>
        {doctors.map((d, i) => (
          <label
            key={d.id}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-control border border-border-strong p-3",
              "has-[:checked]:border-primary has-[:checked]:bg-primary-soft",
            )}
          >
            <input
              type="radio"
              name="doctor_id"
              value={d.id}
              defaultChecked={state.values?.doctor_id ? state.values.doctor_id === d.id : i === 0}
              className="size-4 accent-[var(--primary)]"
            />
            <span>
              <span className="block font-semibold">{d.name}</span>
              <span className="block text-sm text-muted">
                {[d.specialty, d.clinic].filter(Boolean).join(" · ")}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="when" className="font-medium">
          Date and time
        </label>
        <input
          id="when"
          type="datetime-local"
          required
          className={inputClasses}
          onChange={(e) =>
            setScheduledAt(e.target.value ? new Date(e.target.value).toISOString() : "")
          }
        />
        <input type="hidden" name="scheduled_at" value={scheduledAt} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="reason" className="font-medium">
          Reason for visit <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={3}
          maxLength={500}
          defaultValue={state.values?.reason}
          className={cn(inputClasses, "h-auto py-2")}
        />
      </div>

      <label className="flex items-start gap-3 rounded-control bg-primary-soft p-3">
        <input
          type="checkbox"
          name="share_history"
          required
          defaultChecked
          className="mt-1 size-4 accent-[var(--primary)]"
        />
        <span>
          <span className="block font-medium">Share my medicine history with this doctor</span>
          <span className="block text-sm text-muted">
            So they can check new medicines against everything you already take. You can cancel the
            appointment to stop sharing.
          </span>
        </span>
      </label>

      <FormMessage error={state.error} />
      <SubmitButton size="lg" pendingText="Booking…">
        Request appointment
      </SubmitButton>
    </form>
  );
}
