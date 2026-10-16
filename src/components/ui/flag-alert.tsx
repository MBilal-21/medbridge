import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { SeverityBadge, type Severity } from "./badge";

const borders: Record<Severity, string> = {
  high: "border-l-stop",
  moderate: "border-l-change",
  low: "border-l-border-strong",
};

/**
 * One problem found by the drug database (a check_flags row).
 * The finding and its source come from the database; the explanation is the
 * AI's plain-language wording, labelled as such. The doctor decides below it.
 */
export function FlagAlert({
  type,
  severity,
  title,
  explanation,
  source,
  children,
}: {
  type: "duplicate" | "interaction" | "unclear";
  severity: Severity;
  title: ReactNode;
  explanation?: ReactNode;
  source: string;
  children?: ReactNode;
}) {
  const typeLabel = { duplicate: "Duplicate", interaction: "Interaction", unclear: "Unclear" }[type];
  return (
    <div
      role="alert"
      className={cn(
        "rounded-card border border-l-4 border-border bg-surface p-4 shadow-card",
        borders[severity],
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={severity} />
        <span className="text-sm font-medium text-muted">{typeLabel}</span>
      </div>
      <p className="mt-2 font-semibold">{title}</p>
      {explanation && (
        <p className="mt-1 text-muted">
          <span className="font-medium text-text">AI explanation: </span>
          {explanation}
        </p>
      )}
      <p className="mt-2 text-sm text-muted">Source: {source}</p>
      {children && <div className="mt-4 flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
