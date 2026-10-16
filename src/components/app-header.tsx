import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/actions/auth";
import { getCurrentUser, homeFor, type CurrentUser } from "@/lib/auth";
import { Logo } from "./ui/logo";

const nav: Record<CurrentUser["role"], { href: string; label: string }[]> = {
  patient: [
    { href: "/patient", label: "My medicines" },
    { href: "/patient/book", label: "Book" },
    { href: "/patient/uploads", label: "Prescription photos" },
  ],
  doctor: [{ href: "/doctor", label: "Appointments" }],
  admin: [{ href: "/admin", label: "Doctor applications" }],
};

const roleLabel: Record<CurrentUser["role"], string> = {
  patient: "Patient",
  doctor: "Doctor",
  admin: "Admin",
};

/** Static frame of the header; the user part streams in. */
export function AppHeaderFrame({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex min-h-16 w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2">
        {children ?? <Logo />}
      </div>
    </header>
  );
}

export async function AppHeader() {
  const user = await getCurrentUser();
  if (!user) return <AppHeaderFrame />;

  return (
    <AppHeaderFrame>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link href={homeFor(user)}>
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex flex-wrap gap-1">
          {nav[user.role].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-control px-3 py-2 font-medium text-muted hover:bg-surface-muted hover:text-text"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <div className="leading-tight sm:text-right">
          <p className="font-medium">{user.fullName || user.email}</p>
          <p className="text-sm text-muted">{roleLabel[user.role]}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-control border border-border-strong px-3 py-2 text-sm font-medium hover:bg-surface-muted"
          >
            Sign out
          </button>
        </form>
      </div>
    </AppHeaderFrame>
  );
}
