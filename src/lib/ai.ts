import "server-only";
import Groq from "groq-sdk";
import { z } from "zod";

// Created on first use, not at import: the key only exists at runtime, not during `next build`.
let client: Groq | undefined;
const groq = () => (client ??= new Groq({ apiKey: process.env.GROQ_API_KEY }));
const VISION_MODEL = process.env.GROQ_VISION_MODEL ?? "qwen/qwen3.8-27b";
const TEXT_MODEL = process.env.GROQ_TEXT_MODEL ?? "openai/gpt-oss-120b";
// Groq counts the requested maximum against a per-minute output limit (1,000
// tokens on the free tier), and with no cap it assumes the model maximum and
// refuses the call. A full prescription reading is ~100-500 tokens.
const MAX_OUTPUT_TOKENS = 600;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const readingSchema = z.object({
  doctor_name: z.string().nullish(),
  prescribed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish().catch(null),
  medicines: z
    .array(
      z.object({
        name: z.string().min(1),
        strength: z.string().nullish(),
        dose: z.string().nullish(),
        frequency: z.string().nullish(),
        dose_times: z.array(time).catch([]).default([]),
        instructions: z.string().nullish(),
        confidence: z.number().min(0).max(1).catch(0.5).default(0.5),
      }),
    )
    .default([]),
});

export type PrescriptionReading = z.infer<typeof readingSchema>;

const readingPrompt = `You read photos of handwritten or printed medical prescriptions, often from Pakistan.
Copy only what is written. Do not add, correct or suggest medicines.
Reply with JSON only:
{"doctor_name": string|null, "prescribed_on": "YYYY-MM-DD"|null,
 "medicines": [{"name": brand or generic name as written, "strength": e.g. "500 mg"|null,
   "dose": e.g. "1 tablet"|null, "frequency": e.g. "Twice a day"|null,
   "dose_times": 24h times implied by the frequency, else []. Pakistani "morning+afternoon+night" notation:
     1+0+0 = ["08:00"], 0+0+1 = ["21:00"], 1+0+1 = ["08:00","20:00"], 1+1+1 = ["08:00","14:00","20:00"],
     1+1+1+1 = ["08:00","12:00","16:00","20:00"]. "SOS" or "when needed" = [],
   "instructions": e.g. "After meals"|null, "confidence": 0 to 1, how sure you are you read this line correctly}]}
If the image is not a prescription, return {"medicines": []}.`;

/** Reads the medicines on a prescription photo. The patient checks every line before it is saved. */
export async function readPrescriptionPhoto(imageUrl: string): Promise<PrescriptionReading> {
  const res = await groq().chat.completions.create({
    model: VISION_MODEL,
    temperature: 0,
    max_completion_tokens: MAX_OUTPUT_TOKENS,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: readingPrompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
  });
  return readingSchema.parse(JSON.parse(res.choices[0]?.message?.content ?? "{}"));
}

const explainSchema = z.object({
  explanations: z.array(z.object({ id: z.string(), text: z.string() })),
});

/**
 * Plain-language wording of findings the drug database already made. The AI
 * only explains; it gets no say in what is flagged. Returns an empty map if
 * the AI is unavailable, and the doctor still sees the database finding.
 */
export async function explainFindings(
  findings: { id: string; type: string; severity: string; medicines: string[]; finding: string }[],
): Promise<Map<string, string>> {
  if (!findings.length) return new Map();
  try {
    const res = await groq().chat.completions.create({
      model: TEXT_MODEL,
      temperature: 0.2,
      max_completion_tokens: MAX_OUTPUT_TOKENS,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You help a busy doctor review warnings from a drug database. For each finding, write 1-2 short, plain sentences: what the risk is and what to watch for. " +
            "Explain only the finding given. Do not add other interactions, do not say the finding is wrong, and do not tell the doctor what to prescribe. " +
            'Reply with JSON only: {"explanations": [{"id": string, "text": string}]}',
        },
        { role: "user", content: JSON.stringify(findings) },
      ],
    });
    const parsed = explainSchema.parse(JSON.parse(res.choices[0]?.message?.content ?? "{}"));
    const ids = new Set(findings.map((f) => f.id));
    return new Map(parsed.explanations.filter((e) => ids.has(e.id)).map((e) => [e.id, e.text]));
  } catch (err) {
    console.error("AI explanation failed", err);
    return new Map();
  }
}
