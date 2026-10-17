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

/** Best preset for times read from a photo, e.g. ["08:00","20:00"] -> "twice". */
export function frequencyForTimes(times: string[]): FrequencyValue {
  if (times.length === 1) return times[0] >= "17:00" ? "once_night" : "once_morning";
  return ({ 2: "twice", 3: "three", 4: "four" } as const)[times.length] ?? "as_needed";
}
