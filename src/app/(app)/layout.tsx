import { Suspense } from "react";
import { AppHeader, AppHeaderFrame } from "@/components/app-header";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <Suspense fallback={<AppHeaderFrame />}>
        <AppHeader />
      </Suspense>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
