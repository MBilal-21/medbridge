"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { formValues, type FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";

const signUpSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name."),
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  account_type: z.enum(["patient", "doctor"]),
});

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  const { full_name, email, password, account_type } = parsed.data;
  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name, account_type },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) return { error: error.message, values };

  // Email confirmation is on: no session until the link is clicked.
  if (!data.session) {
    return {
      success: `Check ${email} for a confirmation link, then sign in.`,
      values: {},
    };
  }

  redirect(account_type === "doctor" ? "/doctor/apply" : "/patient");
}

const signInSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      error:
        error.code === "email_not_confirmed"
          ? "Please confirm your email first. Check your inbox for the link."
          : "Email or password is incorrect.",
      values,
    };
  }

  const user = await getCurrentUser();
  redirect(user ? homeFor(user) : "/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
