import "server-only";

export type CalendarMedicine = {
  id: string;
  name: string;
  dose: string | null;
  instructions: string | null;
  dose_times: string[];
  start_date: string | null;
  end_date: string | null;
};

// Pakistan has no daylight saving time, so one fixed offset is the whole zone.
const TIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Asia/Karachi",
  "BEGIN:STANDARD",
  "DTSTART:19700101T000000",
  "TZOFFSETFROM:+0500",
  "TZOFFSETTO:+0500",
  "TZNAME:PKT",
  "END:STANDARD",
  "END:VTIMEZONE",
];

function text(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
}

/**
 * A calendar file with a daily reminder at each dose time. Repeats until the
 * end date, or for 30 days when the medicine has none, so reminders don't run forever.
 */
export function buildCalendar(medicines: CalendarMedicine[]) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const events = medicines.flatMap((m) =>
    m.dose_times.map((t) => {
      const start = (m.start_date && m.start_date > today() ? m.start_date : today()).replace(/-/g, "");
      const hhmm = t.slice(0, 5).replace(":", "");
      const repeat = m.end_date
        ? // UNTIL must be UTC; 23:59:59 in Pakistan is 18:59:59 UTC.
          `RRULE:FREQ=DAILY;UNTIL=${m.end_date.replace(/-/g, "")}T185959Z`
        : "RRULE:FREQ=DAILY;COUNT=30";
      return [
        "BEGIN:VEVENT",
        `UID:${m.id}-${hhmm}@medbridge`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=Asia/Karachi:${start}T${hhmm}00`,
        "DURATION:PT10M",
        repeat,
        `SUMMARY:${text(`Take ${m.name}${m.dose ? ` ${m.dose}` : ""}`)}`,
        m.instructions ? `DESCRIPTION:${text(m.instructions)}` : null,
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${text(`Time to take ${m.name}`)}`,
        "TRIGGER:PT0M",
        "END:VALARM",
        "END:VEVENT",
      ].filter((line) => line !== null);
    }),
  );
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MedBridge//Medicine reminders//EN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:MedBridge medicines",
    ...TIMEZONE,
    ...events.flat(),
    "END:VCALENDAR",
  ].join("\r\n");
}
