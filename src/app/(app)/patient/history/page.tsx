import type { Metadata } from "next";
import { Suspense } from "react";
import { CareTeam, HistoryTimeline } from "@/components/medicine-history";
import { LoadingBlock, PageTitle } from "@/components/page-parts";
import { requireRole } from "@/lib/auth";
import { loadHistory } from "@/lib/history";
import { createClient } from "@/lib/supabase/server";
import { MedicineTabs } from "../medicine-tabs";

export const metadata: Metadata = { title: "Medicine history" };

export default function HistoryPage() {
  return (
    <>
      <PageTitle title="My medicines" description="Every prescription and every doctor's decision, in order." />
      <MedicineTabs active="history" />
      <Suspense fallback={<LoadingBlock lines={4} />}>
        <History />
      </Suspense>
    </>
  );
}

async function History() {
  const user = await requireRole("patient");
  const supabase = await createClient();
  const { events, careTeam } = await loadHistory(supabase, user.id);
  return (
    <>
      <CareTeam members={careTeam} viewer="patient" />
      <HistoryTimeline events={events} viewer="patient" />
    </>
  );
}
