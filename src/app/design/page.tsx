import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { DecisionBadge, SeverityBadge, Tag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { FlagAlert } from "@/components/ui/flag-alert";
import { CameraIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Design system" };

const colors = [
  { name: "primary", token: "bg-primary", use: "Brand, main actions, links" },
  { name: "stop", token: "bg-stop", use: "STOP, high-risk flags, errors" },
  { name: "continue", token: "bg-continue", use: "CONTINUE, confirmed items" },
  { name: "new", token: "bg-new", use: "NEW medicines, information" },
  { name: "change", token: "bg-change", use: "CHANGE, moderate flags, check this" },
  { name: "surface", token: "bg-surface border border-border", use: "Cards and panels" },
  { name: "bg", token: "bg-bg border border-border", use: "Page background" },
  { name: "muted", token: "bg-muted", use: "Secondary text" },
];

const sampleList = [
  { name: "Panadol 500 mg", detail: "1 tablet · 08:00, 20:00", by: "Dr Khan (from photo)", decision: "continue" },
  { name: "Calpol 120 mg/5 ml", detail: "Same medicine as Panadol", by: "Dr Ahmed", decision: "stop" },
  { name: "Disprin 300 mg", detail: "Replaced because of warfarin", by: "Dr Ahmed", decision: "change" },
  { name: "Norvasc 5 mg", detail: "1 tablet · 08:00", by: "Dr Ahmed", decision: "new" },
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/">
            <Logo />
          </Link>
          <span className="text-sm text-muted">Design system</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">MedBridge design system</h1>
          <p className="mt-2 max-w-2xl text-muted">
            One theme for every screen. Use these tokens and components instead of raw Tailwind
            colours. Status colours always come with an icon and a word, never colour alone.
          </p>
        </div>

        <Section title="Colours">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {colors.map((c) => (
              <div key={c.name} className="rounded-card border border-border bg-surface p-3">
                <div className={`h-12 rounded-control ${c.token}`} />
                <p className="mt-2 font-mono text-sm font-medium">{c.name}</p>
                <p className="text-sm text-muted">{c.use}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Typography">
          <Card className="flex flex-col gap-2">
            <p className="text-4xl font-semibold tracking-tight">Page title · 4xl semibold</p>
            <p className="text-xl font-semibold">Section title · xl semibold</p>
            <p>Body text · 17px base, so older patients can read it easily.</p>
            <p className="text-muted">Secondary text · text-muted</p>
            <p className="tabular font-mono">Dose times · 08:00 · 14:00 · 20:00</p>
          </Card>
        </Section>

        <Section title="Decisions and severity">
          <div className="flex flex-wrap gap-2">
            <DecisionBadge decision="stop" />
            <DecisionBadge decision="continue" />
            <DecisionBadge decision="new" />
            <DecisionBadge decision="change" />
          </div>
          <div className="flex flex-wrap gap-2">
            <SeverityBadge severity="high" />
            <SeverityBadge severity="moderate" />
            <SeverityBadge severity="low" />
            <Tag>From photo</Tag>
            <Tag>Dr Ahmed</Tag>
          </div>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Book appointment</Button>
            <Button variant="secondary">Cancel</Button>
            <Button variant="ghost">View history</Button>
            <Button variant="danger">Stop medicine</Button>
            <Button disabled>Disabled</Button>
            <Button size="lg">
              <CameraIcon className="size-5" />
              Upload prescription photo
            </Button>
          </div>
        </Section>

        <Section title="Form fields">
          <Card className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" placeholder="Ayesha Malik" />
            <Field label="Email" type="email" hint="Your medicine list is sent here." />
            <Field label="Phone" error="Enter a valid phone number." defaultValue="03-12" />
          </Card>
        </Section>

        <Section title="Doctor view: flags to review">
          <div className="grid gap-4 lg:grid-cols-2">
            <FlagAlert
              type="interaction"
              severity="high"
              title="Coumadin (warfarin) + Disprin (aspirin)"
              explanation="Taking these together makes serious bleeding more likely."
              source="Drug interaction database"
            >
              <Button variant="danger">Stop Disprin</Button>
              <Button variant="secondary">Change</Button>
              <Button variant="ghost">Keep both</Button>
            </FlagAlert>
            <FlagAlert
              type="duplicate"
              severity="moderate"
              title="Panadol and Calpol are both paracetamol"
              explanation="The patient would be taking the same medicine twice under two brand names."
              source="RxNorm ingredient match"
            >
              <Button variant="danger">Stop Calpol</Button>
              <Button variant="ghost">Keep both</Button>
            </FlagAlert>
          </div>
        </Section>

        <Section title="Patient view: my medicine list">
          <Card>
            <CardHeader
              title="Your medicines"
              description="Approved by Dr Ahmed on 16 Oct 2026"
              action={<Button variant="secondary">Add to calendar</Button>}
            />
            <ul className="divide-y divide-border">
              {sampleList.map((m) => (
                <li key={m.name} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">{m.name}</p>
                    <p className="tabular text-sm text-muted">
                      {m.detail} · {m.by}
                    </p>
                  </div>
                  <DecisionBadge decision={m.decision} />
                </li>
              ))}
            </ul>
          </Card>
        </Section>

        <Section title="Demo metric">
          <Card className="bg-primary-soft">
            <p className="text-sm font-medium text-primary">Check result</p>
            <p className="tabular mt-1 text-3xl font-semibold">12 medicines checked in 1.4 s</p>
            <p className="mt-1 text-muted">2 duplicates · 1 interaction · sample numbers</p>
          </Card>
        </Section>
      </main>
    </div>
  );
}
