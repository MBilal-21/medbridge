"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./button";
import { CheckIcon, WarningIcon } from "./icons";

/** Submit button that disables itself and shows progress while the form is sending. */
export function SubmitButton({
  children,
  pendingText,
  ...props
}: ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? (pendingText ?? "Please wait…") : children}
    </Button>
  );
}

/** Error or success line under a form. Announced to screen readers. */
export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  const isError = !!error;
  return (
    <p
      role={isError ? "alert" : "status"}
      className={
        "flex items-start gap-2 rounded-control px-3 py-2 text-sm font-medium " +
        (isError ? "bg-stop-soft text-stop" : "bg-continue-soft text-continue")
      }
    >
      {isError ? (
        <WarningIcon className="mt-0.5 size-4 shrink-0" />
      ) : (
        <CheckIcon className="mt-0.5 size-4 shrink-0" />
      )}
      {error ?? success}
    </p>
  );
}
