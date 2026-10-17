# MedBridge

**No medicine falls through the gap.**

Patients with several long-term conditions see a different doctor for each one. Each doctor prescribes correctly for their own condition, but the combined list can contain duplicates, clashes and old medicines nobody stopped. MedBridge keeps one medicine list per patient across all of their doctors, checks every new prescription against it, and lets the doctor decide what to stop, continue or start.

> Decision support only. The drug database finds problems, the AI explains them, and the doctor makes every clinical decision. The interaction data in `supabase/seed.sql` is demo data and must be reviewed by a doctor, or replaced by a licensed source, before clinical use.

## How it works

1. **The patient brings every prescription.** They upload photos of prescriptions from any doctor, including doctors who don't use MedBridge. AI reads each photo, and the patient corrects and confirms every line.
2. **MedBridge checks the whole list.** Every brand is mapped to its active ingredients, so duplicates under different brand names and known interactions are found.
3. **The doctor reviews.** They see the full list from every doctor with problems marked, then prescribe or review the list. Each warning shows the database finding, its source and a plain-language AI explanation.
4. **The doctor decides** STOP, CONTINUE, NEW or CHANGE for every medicine.
5. **The patient follows a clear list:** a medicine pack by time of day, stopped medicines listed separately, a full history, a calendar file and email reminders at each dose time.

### Who does what

| | Role |
|---|---|
| **Drug database** | Finds duplicates and interactions. Fixed rules, no guessing. |
| **AI** | Reads prescription photos and explains warnings. Never decides. |
| **Doctor** | Makes every decision. |
| **Patient** | Confirms what the AI read, follows the doctor-approved list, controls who can see it. |

## Features

**Patient**
- **Today:** a medicine pack with one compartment per dose time and the next dose highlighted, stopped medicines, appointments, and "possible problems" that no doctor has decided on yet (shown without medical advice).
- **History:** every doctor who prescribes for the patient, and a timeline of every prescription and doctor review.
- **Sharing:** share the history with any approved doctor at any time, and withdraw access.
- **Prescription photos:** upload a photo, the AI reads it, and the patient confirms it. The full list is checked straight away.
- **Reminders:** email reminders at each dose time (they can be turned off), plus a downloadable `.ics` calendar file.

**Doctor**
- Appointments, and a "Shared with you" list of patients.
- Each patient's full current list with warnings, plus their full history.
- **New prescription:** saving it runs the full check.
- **Review list and decide:** runs the check and opens decisions without prescribing anything.
- Decision list with flagged medicines first; the approved list is sent to the patient by email with a calendar file.

**Admin**
- Verifies doctor licences (PMDC) before a doctor can be booked or see patient data.
- Patients list (counts only, no medicine details) and demo metrics: checks run, duplicates and interactions caught, average check time.

## How a check works

Implemented in [`src/lib/drugs.ts`](src/lib/drugs.ts):

1. Load every active medicine of the patient, from every doctor and every photo.
2. Map each medicine to its active ingredients: the MedBridge brand list first (local brands), then [RxNorm](https://lhncbc.nlm.nih.gov/RxNav/). Weak fuzzy matches are rejected. New matches are saved. Unmatched medicines are flagged as **unclear**, never skipped.
3. A shared ingredient between two medicines is a **duplicate**.
4. For each pair of different ingredients: look up `drug_interactions`. If the pair is not there, search the [openFDA](https://open.fda.gov/apis/drug/label/) drug label of each ingredient for the other. FDA findings are saved with their source, so later checks are instant.
5. The AI ([`src/lib/ai.ts`](src/lib/ai.ts)) explains each finding in plain words. It receives only the findings and cannot add or remove one.

## Tech stack

| | |
|---|---|
| App | Next.js 16 (App Router, Cache Components), React 19, Tailwind CSS 4 |
| Data | Supabase: Postgres with row-level security, Auth, Storage, Realtime, `pg_cron` + `pg_net` |
| Drug data | RxNorm (brand to ingredient), openFDA drug labels (interactions), curated table |
| AI | Groq: vision model reads photos, text model explains findings |
| Email | Resend, plus `.ics` calendar files |
| Hosting | Alternate Clouds |

Access rules are enforced in the database (see `supabase/migrations`). A doctor can see a patient only through an open appointment the patient shared, or a direct share, and only after an admin has approved the doctor.

## Project structure

```
src/
  app/
    (auth)/            login and sign-up
    (app)/patient/     Today, History, Sharing, Book, Prescription photos, calendar file
    (app)/doctor/      appointments, appointment review, shared patient history, apply
    (app)/admin/       doctor applications, patients, demo metrics
    actions/           server actions (patient, doctor, prescription, admin, auth)
    api/reminders/     called by pg_cron every 5 minutes to send dose reminders
  components/          shared UI (medicine list with warnings, history timeline, live updates)
  lib/
    drugs.ts           brand matching and the medicine check
    ai.ts              photo reading and explanations (Groq)
    review.ts          the doctor's decisions as the patient's list and email
    reminders.ts       dose reminder emails
    history.ts         patient history and care team
    supabase/          clients and generated database types
  instrumentation.ts   server start-up settings
supabase/
  migrations/          schema, RLS policies, sharing, reminders
  seed.sql             demo drug reference data
```

## Getting started

### 1. Requirements

- Node.js 20.9+
- A [Supabase](https://supabase.com) project and the [Supabase CLI](https://supabase.com/docs/guides/cli)
- API keys for [Groq](https://console.groq.com) and [Resend](https://resend.com)

### 2. Install and configure

```bash
npm install
cp .env.example .env.local   # then fill in the values
```

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | From the Supabase project. Read at runtime, so they don't need to be set at build time. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Never expose it. |
| `GROQ_API_KEY` | Optional overrides: `GROQ_VISION_MODEL`, `GROQ_TEXT_MODEL` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Without a verified domain, Resend only delivers to the account owner's address. |

### 3. Database

```bash
supabase link --project-ref <your-project-ref>
supabase db push                      # apply migrations
psql "$DATABASE_URL" -f supabase/seed.sql   # or run seed.sql in the Supabase SQL editor
```

To make the first admin, sign up normally, then run this in the SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

### 4. Run

```bash
npm run dev     # http://localhost:3000
npm run lint
npm run build && npm start
```

### 5. Dose reminders (optional)

`pg_cron` calls `POST /api/reminders` every 5 minutes. It does nothing until you set two values, which stay out of git. Run in the SQL editor:

```sql
insert into public.app_settings (key, value) values
  ('app_url', 'https://your-app.example.com'),
  ('cron_secret', '<a long random string>');
```

The endpoint checks the secret, emails each patient the medicines due now, and records each send in `dose_reminders` so no dose is emailed twice. `app_settings.reminders_last_run` shows when it last ran.

## Deployment notes

- **Platform:** the app is deployed on Alternate Clouds from this repository; every push to `main` rebuilds and redeploys.
- **Push one change at a time:** wait for each deploy to finish before pushing again, because overlapping deploys can fail on the Akash network (`bid not open`, `code 32`).
- **Environment variables:** set all six in the service settings.

## Testing

Each kind of warning (high, moderate, duplicate, FDA-label and unknown medicine) has a test patient with one known problem and a confirmed appointment. Ask the team for the test accounts. They are not listed here because this repository is public.

## Roadmap

- Replace the demo interaction data with a licensed, clinically reviewed source (for example DrugBank).
- An MCP connection so patients can ask their own AI assistant "What do I take tonight?" from their doctor-approved list.
- Urdu interface.
