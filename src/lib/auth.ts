import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type Role = Database["public"]["Enums"]["user_role"];
export type VerificationStatus = Database["public"]["Enums"]["verification_status"];

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  /** Set when the user has applied as a doctor. */
  doctorStatus: VerificationStatus | null;
  /** Chose "I am a doctor" at sign-up but has not applied yet. */
  needsDoctorApplication: boolean;
};

/** The signed-in user, or null. Verifies the session with Supabase. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: doctor }] = await Promise.all([
    supabase.from("profiles").select("full_name, role").eq("id", user.id).single(),
    supabase.from("doctors").select("verification_status").eq("profile_id", user.id).maybeSingle(),
  ]);
  if (!profile) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile.full_name,
    role: profile.role,
    doctorStatus: doctor?.verification_status ?? null,
    needsDoctorApplication:
      profile.role === "patient" && !doctor && user.user_metadata?.account_type === "doctor",
  };
}

/** The signed-in user, redirecting to /login if there is none. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** The signed-in user with this role, redirecting everyone else to their own home. */
export async function requireRole(role: Role): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== role) redirect(homeFor(user));
  return user;
}

/** Where each kind of user lands after signing in. */
export function homeFor(user: Pick<CurrentUser, "role" | "needsDoctorApplication">): string {
  if (user.needsDoctorApplication) return "/doctor/apply";
  return { patient: "/patient", doctor: "/doctor", admin: "/admin" }[user.role];
}
