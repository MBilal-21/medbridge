import { connection } from "next/server";
import { Suspense } from "react";
import { AppHeader, AppHeaderFrame } from "@/components/app-header";
import { LiveRefresh } from "@/components/live-refresh";
import { supabaseEnv } from "@/lib/supabase/env";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <Suspense fallback={null}>
        <LiveUpdates />
      </Suspense>
      <Suspense fallback={<AppHeaderFrame />}>
        <AppHeader />
      </Suspense>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        {children}
      </main>
    </div>
  );
}

/** Reads the Supabase config per request, so it is never frozen into the build. */
async function LiveUpdates() {
  await connection();
  const { url, publishableKey } = supabaseEnv();
  return <LiveRefresh url={url} publishableKey={publishableKey} />;
}
