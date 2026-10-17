"use client";

import { useActionState, useState } from "react";
import { submitDecisions } from "@/app/actions/prescription";
import { Tag } from "@/components/ui/badge";
import { inputClasses } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form-parts";
import { WarningIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { emptyFormState } from "@/lib/form-state";

type Choice = "new" | "continue" | "change" | "stop";

const choiceStyles: Record<Choice, { label: string; checked: string }> = {
  new: { label: "NEW", checked: "has-[:checked]:bg-new-soft has-[:checked]:text-new has-[:checked]:border-new" },
  continue: {
    label: "CONTINUE",
    checked: "has-[:checked]:bg-continue-soft has-[:checked]:text-continue has-[:checked]:border-continue",
  },
  change: {
    label: "CHANGE",
    checked: "has-[:checked]:bg-change-soft has-[:checked]:text-change has-[:checked]:border-change",
  },
  stop: { label: "STOP", checked: "has-[:checked]:bg-stop-soft has-[:checked]:text-stop has-[:checked]:border-stop" },
};

export type DecisionMedicine = {
  id: string;
  name: string;
  details: string;
  prescribedBy: string | null;
  isNew: boolean;
  flagged: boolean;
};

/** One decision per medicine on the full list. The patient gets exactly this list. */
export function DecisionForm({ checkId, medicines }: { checkId: string; medicines: DecisionMedicine[] }) {
  const [state, action] = useActionState(submitDecisions.bind(null, checkId), emptyFormState);
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(medicines.map((m) => [m.id, m.isNew ? "new" : "continue"])),
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <ul className="divide-y divide-border">
        {medicines.map((m) => {
          const options: Choice[] = m.isNew ? ["new", "change", "stop"] : ["continue", "change", "stop"];
          return (
            <li key={m.id} className="flex flex-col gap-3 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    {m.flagged && <WarningIcon className="size-4 shrink-0 text-change" aria-label="Has a warning" />}
                    {m.name}
                  </p>
                  <p className="tabular text-sm text-muted">{m.details || "No dose details"}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {m.isNew ? <Tag>This prescription</Tag> : m.prescribedBy && <Tag>{m.prescribedBy}</Tag>}
                  </div>
                </div>
                <fieldset className="flex flex-wrap gap-2">
                  <legend className="sr-only">Decision for {m.name}</legend>
                  {options.map((c) => (
                    <label
                      key={c}
                      className={cn(
                        "inline-flex h-10 cursor-pointer items-center rounded-full border border-border-strong px-3.5 text-sm font-semibold text-muted",
                        "hover:bg-surface-muted has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring",
                        choiceStyles[c].checked,
                      )}
                    >
                      <input
                        type="radio"
                        name={`decision-${m.id}`}
                        value={c}
                        checked={choices[m.id] === c}
                        onChange={() => setChoices((s) => ({ ...s, [m.id]: c }))}
                        className="sr-only"
                      />
                      {choiceStyles[c].label}
                    </label>
                  ))}
                </fieldset>
              </div>
              {(choices[m.id] === "change" || choices[m.id] === "stop") && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">
                    {choices[m.id] === "change" ? "What changes (required)" : "Note for the patient (optional)"}
                  </span>
                  <input
                    name={`note-${m.id}`}
                    required={choices[m.id] === "change"}
                    placeholder={choices[m.id] === "change" ? "Take 250 mg instead of 500 mg" : "Clashes with your new medicine"}
                    className={inputClasses}
                  />
                </label>
              )}
            </li>
          );
        })}
      </ul>
      <FormMessage error={state.error} success={state.success} />
      <SubmitButton size="lg" pendingText="Sending…">
        Approve and send list to patient
      </SubmitButton>
    </form>
  );
}
