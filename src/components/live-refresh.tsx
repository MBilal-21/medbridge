"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Tables the app pages read. Realtime only sends a user the rows RLS lets them
// see, so one subscription works for every role.
const TABLES = [
  "doctors",
  "appointments",
  "prescription_uploads",
  "prescriptions",
  "medications",
  "medication_decisions",
] as const;

/** Re-renders the current page when data it may show changes in the database. */
export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // One save can touch several rows; refresh once after they settle.
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };

    const channel = supabase.channel("live-refresh");
    for (const table of TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }

    let cancelled = false;
    // Send the user's token first so RLS filters the events.
    supabase.realtime.setAuth().then(() => {
      if (!cancelled) channel.subscribe();
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
