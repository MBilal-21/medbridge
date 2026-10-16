/** Result returned by a Server Action to a form using useActionState. */
export type FormState = {
  error?: string;
  success?: string;
  /** Echo of submitted text fields, so a failed submit keeps what was typed. */
  values?: Record<string, string>;
};

export const emptyFormState: FormState = {};

/** Text fields of a submission, without the files or Next.js internals. */
export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData) {
    if (typeof value === "string" && !key.startsWith("$ACTION") && key !== "password") {
      values[key] = value;
    }
  }
  return values;
}
