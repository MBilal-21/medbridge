import Link from "next/link";
import { DecisionBadge, SeverityBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CameraIcon, CheckIcon, WarningIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";

const steps = [
  {
    Icon: CameraIcon,
    title: "Bring every prescription",
    text: "Patients upload photos of prescriptions from any doctor. AI reads the medicines and the patient confirms them.",
  },
  {
    Icon: WarningIcon,
    title: "Check the full list",
    text: "Every new prescription is checked against all current medicines using a drug database: duplicates under different brand names and known clashes.",
  },
  {
    Icon: CheckIcon,
    title: "The doctor decides",
    text: "The doctor reviews each warning and chooses what to stop, continue or change. The patient gets a clear list and dose reminders.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
          <Logo />
          <nav className="flex items-center gap-2">
            <Link href="/login" className={buttonClasses("ghost")}>
              Sign in
            </Link>
            <Link href="/signup" className={buttonClasses("primary")}>
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-5xl items-center gap-10 px-4 py-16 sm:py-24 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-6">
            <p className="font-medium text-primary">No medicine falls through the gap</p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              One medicine list per patient, across every doctor.
            </h1>
            <p className="text-lg text-muted">
              Patients see several doctors, and no one sees the whole list. MedBridge checks every
              new prescription against everything the patient already takes, and the doctor
              decides what to do.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/signup" className={buttonClasses("primary", "lg")}>
                Create a free account
              </Link>
              <Link href="/login" className={buttonClasses("secondary", "lg")}>
                Sign in
              </Link>
            </div>
          </div>

          {/* Preview of what a doctor sees after a check. */}
          <Card className="flex flex-col gap-3" aria-label="Example check result">
            <p className="text-sm font-medium text-muted">Example check · 4 medicines</p>
            <div className="rounded-control border border-l-4 border-border border-l-stop p-3">
              <SeverityBadge severity="high" />
              <p className="mt-2 font-semibold">Coumadin (warfarin) + Disprin (aspirin)</p>
              <p className="text-sm text-muted">Higher risk of serious bleeding.</p>
            </div>
            <div className="rounded-control border border-l-4 border-border border-l-change p-3">
              <SeverityBadge severity="moderate" />
              <p className="mt-2 font-semibold">Panadol and Calpol are both paracetamol</p>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <DecisionBadge decision="stop" />
              <DecisionBadge decision="continue" />
              <DecisionBadge decision="new" />
            </div>
          </Card>
        </section>

        <section className="border-t border-border bg-surface">
          <div className="mx-auto w-full max-w-5xl px-4 py-16">
            <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {steps.map(({ Icon, title, text }, i) => (
                <li key={title} className="flex flex-col gap-3">
                  <span className="grid size-11 place-items-center rounded-control bg-primary-soft text-primary">
                    <Icon className="size-6" />
                  </span>
                  <p className="font-semibold">
                    {i + 1}. {title}
                  </p>
                  <p className="text-muted">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 py-16">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <p className="font-semibold">AI checks</p>
              <p className="mt-1 text-muted">
                Reads prescription photos and explains warnings in plain language. It never
                prescribes.
              </p>
            </Card>
            <Card>
              <p className="font-semibold">Doctors decide</p>
              <p className="mt-1 text-muted">
                Every flag goes to a verified doctor, who makes the final call on each medicine.
              </p>
            </Card>
            <Card>
              <p className="font-semibold">Admins verify</p>
              <p className="mt-1 text-muted">
                Doctors are checked against their license before they can see any patient data.
              </p>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap justify-between gap-2 px-4 py-6 text-sm text-muted">
          <span>MedBridge · decision support for doctors, not a replacement for them.</span>
          <Link href="/design" className="hover:text-text">
            Design system
          </Link>
        </div>
      </footer>
    </div>
  );
}
