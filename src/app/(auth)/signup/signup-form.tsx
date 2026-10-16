"use client";

import { useActionState } from "react";
import { signUp } from "@/app/actions/auth";
import { Field } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form-parts";
import { emptyFormState } from "@/lib/form-state";
import { cn } from "@/lib/cn";

const accountTypes = [
  { value: "patient", title: "I'm a patient", text: "Keep my medicines in one list." },
  { value: "doctor", title: "I'm a doctor", text: "Review patients' full medicine lists." },
] as const;

export function SignupForm() {
  const [state, action] = useActionState(signUp, emptyFormState);
  const chosen = state.values?.account_type ?? "patient";

  if (state.success) return <FormMessage success={state.success} />;

  return (
    <form action={action} className="flex flex-col gap-4">
      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="mb-1.5 font-medium">Account type</legend>
        {accountTypes.map((t) => (
          <label
            key={t.value}
            className={cn(
              "cursor-pointer rounded-control border border-border-strong bg-surface p-3",
              "has-[:checked]:border-primary has-[:checked]:bg-primary-soft",
              "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring",
            )}
          >
            <input
              type="radio"
              name="account_type"
              value={t.value}
              defaultChecked={chosen === t.value}
              className="sr-only"
            />
            <span className="block font-semibold">{t.title}</span>
            <span className="block text-sm text-muted">{t.text}</span>
          </label>
        ))}
      </fieldset>
      <Field
        label="Full name"
        name="full_name"
        autoComplete="name"
        required
        defaultValue={state.values?.full_name}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        hint="At least 8 characters."
      />
      <FormMessage error={state.error} />
      <SubmitButton size="lg" pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
