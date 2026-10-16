import type { Database } from "@/lib/supabase/database.types";
import { cn } from "@/lib/cn";

type Status = Database["public"]["Enums"]["appointment_status"];

const tones: Record<Status, { label: string; className: string }> = {
  requested: { label: "Requested", className: "bg-change-soft text-change" },
  confirmed: { label: "Confirmed", className: "bg-new-soft text-new" },
  completed: { label: "Completed", className: "bg-continue-soft text-continue" },
  cancelled: { label: "Cancelled", className: "bg-surface-muted text-muted" },
};

export function AppointmentStatus({ status }: { status: Status }) {
  const tone = tones[status];
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-sm font-semibold", tone.className)}>
      {tone.label}
    </span>
  );
}
