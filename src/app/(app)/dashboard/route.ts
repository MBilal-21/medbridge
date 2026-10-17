import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, homeFor } from "@/lib/auth";

/**
 * Sends each user to their own home: patient, doctor or admin. A route, not a
 * page: redirecting from a page rendered nothing but still made React's dev
 * timing throw ("cannot have a negative time stamp") and reload the page.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  return NextResponse.redirect(new URL(user ? homeFor(user) : "/login", request.url));
}
