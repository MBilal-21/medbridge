import Link from "next/link";
import { cn } from "@/lib/cn";

const tabs = [
  { key: "today", href: "/patient", label: "Today", hint: "What to take" },
  { key: "history", href: "/patient/history", label: "History", hint: "Every doctor, every change" },
  { key: "sharing", href: "/patient/sharing", label: "Sharing", hint: "Who can see it" },
] as const;

/** The three views of "My medicines". */
export function MedicineTabs({ active }: { active: (typeof tabs)[number]["key"] }) {
  return (
    <nav aria-label="My medicines" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex min-w-max gap-1 border-b border-border">
        {tabs.map((t) => (
          <li key={t.key}>
            <Link
              href={t.href}
              aria-current={t.key === active ? "page" : undefined}
              className={cn(
                "-mb-px flex flex-col border-b-3 px-4 pb-2.5 pt-1",
                t.key === active
                  ? "border-primary text-text"
                  : "border-transparent text-muted hover:border-border-strong hover:text-text",
              )}
            >
              <span className="font-semibold">{t.label}</span>
              <span className="text-sm text-muted">{t.hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
