import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

export const inputClasses =
  "h-11 w-full rounded-control border border-border-strong bg-surface px-3 text-base text-text " +
  "placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30";

/** Labelled text input with an optional hint and error. */
export function Field({
  label,
  hint,
  error,
  className,
  ...props
}: ComponentProps<"input"> & { label: string; hint?: string; error?: string }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={cn(inputClasses, error && "border-stop")}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-stop">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-sm text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
