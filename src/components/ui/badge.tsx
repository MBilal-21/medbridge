import type { ComponentType, ReactNode, SVGProps } from "react";
import { cn } from "@/lib/cn";
import { ChangeIcon, CheckIcon, InfoIcon, PlusIcon, StopIcon, WarningIcon } from "./icons";

// Names match the enums in supabase/migrations (decision_type, flag_severity).
export type Decision = "stop" | "continue" | "new" | "change";
export type Severity = "high" | "moderate" | "low";

type Tone = { label: string; className: string; Icon: ComponentType<SVGProps<SVGSVGElement>> };

const decisionTones: Record<Decision, Tone> = {
  stop: { label: "STOP", className: "bg-stop-soft text-stop", Icon: StopIcon },
  continue: { label: "CONTINUE", className: "bg-continue-soft text-continue", Icon: CheckIcon },
  new: { label: "NEW", className: "bg-new-soft text-new", Icon: PlusIcon },
  change: { label: "CHANGE", className: "bg-change-soft text-change", Icon: ChangeIcon },
};

const severityTones: Record<Severity, Tone> = {
  high: { label: "High risk", className: "bg-stop-soft text-stop", Icon: WarningIcon },
  moderate: { label: "Moderate", className: "bg-change-soft text-change", Icon: WarningIcon },
  low: { label: "Low", className: "bg-surface-muted text-muted", Icon: InfoIcon },
};

function Pill({ tone, children }: { tone: Tone; children?: ReactNode }) {
  const { Icon } = tone;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold",
        tone.className,
      )}
    >
      <Icon className="size-4 shrink-0" />
      {children ?? tone.label}
    </span>
  );
}

/** STOP / CONTINUE / NEW / CHANGE. Always shows icon + word, never colour alone. */
export function DecisionBadge({ decision }: { decision: Decision }) {
  return <Pill tone={decisionTones[decision]} />;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <Pill tone={severityTones[severity]} />;
}

/** Neutral label, e.g. "From photo" or "Dr Ahmed". */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-sm text-muted">
      {children}
    </span>
  );
}
