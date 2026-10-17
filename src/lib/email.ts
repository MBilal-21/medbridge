import "server-only";
import { Resend } from "resend";

// Created on first use, not at import: the key only exists at runtime, not during `next build`.
let client: Resend | undefined;
const resend = () => (client ??= new Resend(process.env.RESEND_API_KEY));

type Attachment = { filename: string; content: string | Buffer };

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: Attachment[];
}) {
  const { data, error } = await resend().emails.send({
    from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
    ...opts,
  });
  if (error) throw new Error(`Email failed: ${error.message}`);
  return data;
}
