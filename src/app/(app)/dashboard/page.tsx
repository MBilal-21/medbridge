import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoadingBlock } from "@/components/page-parts";
import { homeFor, requireUser } from "@/lib/auth";

/** Sends each user to their own home: patient, doctor or admin. */
export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <RedirectHome />
    </Suspense>
  );
}

async function RedirectHome(): Promise<null> {
  const user = await requireUser();
  redirect(homeFor(user));
}
