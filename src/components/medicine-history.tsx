import { DecisionBadge, Tag } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { CameraIcon, CheckIcon, PlusIcon } from "@/components/ui/icons";
import { EmptyState, formatDate } from "@/components/page-parts";
import { cn } from "@/lib/cn";
import type { CareTeamMember, HistoryEvent, MedicineStatus } from "@/lib/history";
import { decisionOrder } from "@/lib/review";

const statusTones: Record<MedicineStatus, { label: string; className: string }> = {
  active: { label: "Taking now", className: "bg-continue-soft text-continue" },
  stopped: { label: "Stopped", className: "bg-stop-soft text-stop" },
  completed: { label: "Finished", className: "bg-surface-muted text-muted" },
};

function StatusPill({ status }: { status: MedicineStatus }) {
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-sm font-semibold", statusTones[status].className)}>
      {statusTones[status].label}
    </span>
  );
}

/** Every doctor who has prescribed for this patient, so it is clear who looks after what. */
export function CareTeam({ members, viewer }: { members: CareTeamMember[]; viewer: "patient" | "doctor" }) {
  return (
    <Card>
      <CardHeader
        title={viewer === "patient" ? "Your doctors" : "Doctors who prescribe for this patient"}
        description="Each doctor treats a different condition. MedBridge puts all their medicines in one list."
      />
      {!members.length ? (
        <EmptyState title="No prescriptions yet" />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <li key={m.name} className="flex items-start gap-3 rounded-control border border-border p-3">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full font-semibold",
                  m.external ? "bg-surface-muted text-muted" : "bg-primary-soft text-primary",
                )}
              >
                {m.name.replace(/^Dr\.?\s*/i, "").charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="font-semibold">{m.name}</p>
                <p className="text-sm text-muted">{m.specialty || "Doctor"}</p>
                <p className="mt-1 text-sm">
                  {m.current
                    ? `${m.current} medicine${m.current > 1 ? "s" : ""} taken now`
                    : "No current medicines"}
                </p>
                <p className="tabular text-sm text-muted">Last prescription {formatDate(m.lastSeen)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const decisionHeadings = {
  stop: "Stopped",
  change: "Changed",
  new: "Started",
  continue: "Kept the same",
} as const;

/** Newest first: every prescription and every doctor review, with what happened to each medicine. */
export function HistoryTimeline({ events, viewer }: { events: HistoryEvent[]; viewer: "patient" | "doctor" }) {
  const you = viewer === "patient" ? "You" : "The patient";
  const your = viewer === "patient" ? "your" : "the patient's";
  return (
    <Card>
      <CardHeader
        title="Medicine history"
        description="Newest first. Green means still taken; red means a doctor stopped it."
      />
      {!events.length ? (
        <EmptyState title="No history yet">Prescriptions and doctor reviews will appear here.</EmptyState>
      ) : (
        <ol className="relative ml-4 border-l-2 border-border">
          {events.map((e) => {
            const { Icon, tone } =
              e.kind === "review"
                ? { Icon: CheckIcon, tone: "bg-continue-soft text-continue" }
                : e.source === "photo_upload"
                  ? { Icon: CameraIcon, tone: "bg-surface-muted text-muted" }
                  : { Icon: PlusIcon, tone: "bg-primary-soft text-primary" };
            return (
              <li key={`${e.kind}-${e.id}`} className="relative pb-8 pl-8 last:pb-0">
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute -left-[17px] top-0 flex size-8 items-center justify-center rounded-full ring-4 ring-surface",
                    tone,
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <p className="tabular text-sm font-medium text-muted">{formatDate(e.at)}</p>
                <h3 className="mt-0.5 font-semibold">
                  {e.kind === "review"
                    ? `${e.doctor} checked ${your} full list`
                    : e.source === "photo_upload"
                      ? `${you} added a prescription from ${e.doctor}`
                      : `${e.doctor} prescribed`}
                </h3>
                <p className="text-sm text-muted">
                  {e.kind === "prescription" && e.source === "photo_upload"
                    ? "From a photo · doctor not on MedBridge"
                    : e.specialty}
                </p>

                {e.kind === "prescription" ? (
                  <ul className="mt-3 flex flex-col gap-2">
                    {e.medicines.map((m) => (
                      <li key={m.id} className="rounded-control border border-border p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className={cn("font-semibold", m.status === "stopped" && "line-through decoration-stop/60")}>
                              {m.name}
                            </p>
                            {m.details && <p className="text-sm text-muted">{m.details}</p>}
                          </div>
                          <StatusPill status={m.status} />
                        </div>
                        {m.stopped && (
                          <p className="mt-1.5 text-sm text-stop">
                            Stopped by {m.stopped.by} on {formatDate(m.stopped.on)}
                            {m.stopped.note && `: ${m.stopped.note}`}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3 flex flex-col gap-2">
                    {decisionOrder.map((d) => {
                      const items = e.decisions.filter((x) => x.decision === d);
                      if (!items.length) return null;
                      return (
                        <div key={d} className="flex flex-wrap items-start gap-2">
                          <DecisionBadge decision={d} />
                          <p className="pt-1 text-sm">
                            <span className="sr-only">{decisionHeadings[d]}: </span>
                            {items.map((x, i) => (
                              <span key={x.name}>
                                {i > 0 && ", "}
                                <span className="font-medium">{x.name}</span>
                                {x.note && <span className="text-muted"> ({x.note})</span>}
                              </span>
                            ))}
                          </p>
                        </div>
                      );
                    })}
                    {!e.decisions.length && <Tag>No changes</Tag>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
