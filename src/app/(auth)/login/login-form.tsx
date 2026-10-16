"use client";

import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";
import { Field } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form-parts";
import { emptyFormState } from "@/lib/form-state";

export function LoginForm() {
  const [state, action] = useActionState(signIn, emptyFormState);
  return (
    <form action={action} className="flex flex-col gap-4">
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
        autoComplete="current-password"
        required
      />
      <FormMessage error={state.error} />
      <SubmitButton size="lg" pendingText="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
