/** How often a medicine is taken, with the dose times used for the calendar file. */
export const frequencies = [
  { value: "once_morning", label: "Once a day, morning", times: ["08:00"] },
  { value: "once_night", label: "Once a day, at night", times: ["21:00"] },
  { value: "twice", label: "Twice a day", times: ["08:00", "20:00"] },
  { value: "three", label: "Three times a day", times: ["08:00", "14:00", "20:00"] },
  { value: "four", label: "Four times a day", times: ["08:00", "12:00", "16:00", "20:00"] },
  { value: "as_needed", label: "Only when needed", times: [] },
] as const;

export type FrequencyValue = (typeof frequencies)[number]["value"];

export function frequencyByValue(value: string) {
  return frequencies.find((f) => f.value === value);
}

/**
 * Times from the "morning + afternoon + night" notation on Pakistani
 * prescriptions: "1 + 0 + 1" -> ["08:00", "20:00"]. Empty if it isn't one.
 */
export function timesFromPattern(text: string | null | undefined): string[] {
  const parts = text?.match(/^\s*([01])\s*\+\s*([01])\s*\+\s*([01])(?:\s*\+\s*([01]))?\s*$/);
  if (!parts) return [];
  const slots = parts[4] !== undefined ? ["08:00", "12:00", "16:00", "20:00"] : ["08:00", "14:00", "21:00"];
  const taken = slots.filter((_, i) => parts[i + 1] === "1");
  // Morning and night only is the usual "twice a day".
  return taken.length === 2 && parts[4] === undefined && parts[2] === "0" ? ["08:00", "20:00"] : taken;
}

/** Best preset for times read from a photo, e.g. ["08:00","20:00"] -> "twice". */
export function frequencyForTimes(times: string[]): FrequencyValue {
  if (times.length === 1) return times[0] >= "17:00" ? "once_night" : "once_morning";
  return ({ 2: "twice", 3: "three", 4: "four" } as const)[times.length] ?? "as_needed";
}
