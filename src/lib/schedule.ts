/** Times are Pakistan time (no daylight saving), where the clinics and patients are. */
export const TIMEZONE = "Asia/Karachi";
const OFFSET = "+05:00";

export type Slot = "morning" | "afternoon" | "evening" | "night";

export const slotLabels: Record<Slot, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

/** "08:00:00" -> "morning". */
export function slotFor(time: string): Slot {
  const hour = Number(time.slice(0, 2));
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

/** "20:00:00" -> "8:00 PM". */
export function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Today's date ("2026-10-17") and time ("14:05") in Pakistan. */
export function nowInPakistan(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** The moment a dose is due, from a Pakistan date and time. */
export function dueAt(date: string, time: string) {
  return new Date(`${date}T${time.slice(0, 5)}:00${OFFSET}`);
}
