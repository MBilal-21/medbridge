// Usage: node --env-file=.env.local scripts/test-email.mjs you@example.com
import { Resend } from "resend";

const to = process.argv[2];
if (!to) throw new Error("Pass a recipient email address");

const resend = new Resend(process.env.RESEND_API_KEY);
const { data, error } = await resend.emails.send({
  from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
  to,
  subject: "MedBridge test email",
  html: "<p>Resend is working for <strong>MedBridge</strong>.</p>",
});

if (error) {
  console.error("Failed:", error);
  process.exit(1);
}
console.log("Sent, id:", data.id);
