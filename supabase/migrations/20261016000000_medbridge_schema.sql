-- MedBridge schema
-- One medicine list per patient, across every doctor they visit.
--
-- Flow this schema supports:
--   1. Patient books an appointment and uploads photos of old prescriptions.
--   2. AI reads each photo into medications (patient confirms them).
--   3. Doctor enters a new prescription.
--   4. Drug database (RxNorm + interaction source) checks the full list -> check_flags.
--   5. AI explains each flag; doctor decides STOP / CONTINUE / NEW / CHANGE.
--   6. Patient gets the decided list by email with an .ics calendar file.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('patient', 'doctor');

create type public.appointment_status as enum ('requested', 'confirmed', 'completed', 'cancelled');

-- Where a prescription came from: entered by a MedBridge doctor, or read from a patient's photo.
create type public.prescription_source as enum ('in_app', 'photo_upload');

create type public.upload_status as enum ('uploaded', 'processing', 'needs_confirmation', 'confirmed', 'failed');

create type public.medication_status as enum ('active', 'stopped', 'completed');

create type public.flag_type as enum ('duplicate', 'interaction', 'unclear');

create type public.flag_severity as enum ('low', 'moderate', 'high');

create type public.check_status as enum ('pending_review', 'reviewed');

create type public.decision_type as enum ('stop', 'continue', 'new', 'change');

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'patient',
  full_name text not null default '',
  email text not null,
  phone text,
  date_of_birth date,
  created_at timestamptz not null default now()
);

create table public.doctors (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  specialty text not null default 'General Practice',
  clinic_name text,
  license_number text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Appointments
-- ---------------------------------------------------------------------------

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  doctor_id uuid not null references public.doctors (profile_id) on delete cascade,
  scheduled_at timestamptz not null,
  status public.appointment_status not null default 'requested',
  reason text,
  -- Patient consent: lets this doctor see the patient's full medicine history.
  share_history boolean not null default true,
  created_at timestamptz not null default now()
);

create index appointments_patient_id_idx on public.appointments (patient_id);
create index appointments_doctor_id_idx on public.appointments (doctor_id, scheduled_at);

-- ---------------------------------------------------------------------------
-- Drug reference data (cached from RxNorm and the interaction source).
-- Written by the server with the service role only. The LLM never writes here.
-- ---------------------------------------------------------------------------

-- An active ingredient, keyed by its RxNorm concept id (e.g. paracetamol / acetaminophen).
create table public.ingredients (
  rxcui text primary key,
  name text not null
);

-- A brand or product as written on a prescription (e.g. Panadol 500mg tablet).
create table public.drug_products (
  id uuid primary key default gen_random_uuid(),
  brand_name text not null,
  rxcui text,
  strength text,
  dose_form text,
  unique (brand_name, strength)
);

create index drug_products_brand_name_idx on public.drug_products (lower(brand_name));

-- A product can contain several ingredients (combination tablets).
create table public.product_ingredients (
  product_id uuid not null references public.drug_products (id) on delete cascade,
  ingredient_rxcui text not null references public.ingredients (rxcui) on delete cascade,
  primary key (product_id, ingredient_rxcui)
);

create index product_ingredients_ingredient_idx on public.product_ingredients (ingredient_rxcui);

-- Known ingredient pairs that clash. Stored once per pair, with ingredient_a < ingredient_b.
create table public.drug_interactions (
  ingredient_a text not null references public.ingredients (rxcui) on delete cascade,
  ingredient_b text not null references public.ingredients (rxcui) on delete cascade,
  severity public.flag_severity not null,
  description text not null,
  source text not null,
  primary key (ingredient_a, ingredient_b),
  check (ingredient_a < ingredient_b)
);

create index drug_interactions_ingredient_b_idx on public.drug_interactions (ingredient_b);

-- ---------------------------------------------------------------------------
-- Patient medicine history
-- ---------------------------------------------------------------------------

-- A photo of an old prescription, uploaded by the patient. File lives in the
-- private "prescription-photos" storage bucket under <patient_id>/<file>.
create table public.prescription_uploads (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  status public.upload_status not null default 'uploaded',
  ai_raw_output jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index prescription_uploads_patient_id_idx on public.prescription_uploads (patient_id);

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  source public.prescription_source not null,
  -- Set when a MedBridge doctor wrote it.
  doctor_id uuid references public.doctors (profile_id) on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,
  -- Set when it was read from a photo.
  upload_id uuid references public.prescription_uploads (id) on delete set null,
  external_doctor_name text,
  prescribed_on date,
  created_at timestamptz not null default now(),
  check (
    (source = 'in_app' and doctor_id is not null)
    or (source = 'photo_upload' and upload_id is not null)
  )
);

create index prescriptions_patient_id_idx on public.prescriptions (patient_id);
create index prescriptions_appointment_id_idx on public.prescriptions (appointment_id);

-- One medicine line. Together, a patient's active rows are their medicine list.
create table public.medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  prescription_id uuid not null references public.prescriptions (id) on delete cascade,
  -- Null until the name is matched in the drug database.
  drug_product_id uuid references public.drug_products (id) on delete set null,
  name_as_written text not null,
  dose text,
  frequency text,
  -- Dose times used for the calendar file, e.g. {08:00,20:00}.
  dose_times time[] not null default '{}',
  instructions text,
  start_date date,
  end_date date,
  status public.medication_status not null default 'active',
  -- From photo reading: how sure the AI was, and whether the patient confirmed it.
  ai_confidence numeric(3, 2) check (ai_confidence between 0 and 1),
  patient_confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

create index medications_patient_status_idx on public.medications (patient_id, status);
create index medications_prescription_id_idx on public.medications (prescription_id);
create index medications_drug_product_id_idx on public.medications (drug_product_id);

-- ---------------------------------------------------------------------------
-- Checks and doctor decisions
-- ---------------------------------------------------------------------------

-- One run of the drug database against the patient's full list.
create table public.reconciliation_checks (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  doctor_id uuid not null references public.doctors (profile_id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  new_prescription_id uuid not null references public.prescriptions (id) on delete cascade,
  status public.check_status not null default 'pending_review',
  medications_checked integer not null default 0,
  -- Time the check took, for the demo metric ("N prescriptions checked in X seconds").
  duration_ms integer,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index reconciliation_checks_patient_id_idx on public.reconciliation_checks (patient_id, created_at desc);
create index reconciliation_checks_doctor_id_idx on public.reconciliation_checks (doctor_id, status);

-- A problem the drug database found. ai_explanation is the LLM's plain-language
-- explanation of the database finding; it never creates flags on its own.
create table public.check_flags (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.reconciliation_checks (id) on delete cascade,
  type public.flag_type not null,
  severity public.flag_severity not null,
  medication_a_id uuid not null references public.medications (id) on delete cascade,
  medication_b_id uuid references public.medications (id) on delete cascade,
  ingredient_rxcui text references public.ingredients (rxcui),
  source text not null,
  ai_explanation text,
  created_at timestamptz not null default now()
);

create index check_flags_check_id_idx on public.check_flags (check_id);

-- The doctor's decision for each medicine. This is the patient's STOP / CONTINUE / NEW list.
create table public.medication_decisions (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.reconciliation_checks (id) on delete cascade,
  medication_id uuid not null references public.medications (id) on delete cascade,
  decision public.decision_type not null,
  note text,
  decided_by uuid not null references public.doctors (profile_id),
  decided_at timestamptz not null default now(),
  unique (check_id, medication_id)
);

create index medication_decisions_medication_id_idx on public.medication_decisions (medication_id);

-- Record of each list email sent to a patient.
create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  check_id uuid references public.reconciliation_checks (id) on delete set null,
  sent_to text not null,
  resend_id text,
  sent_at timestamptz not null default now()
);

create index email_log_patient_id_idx on public.email_log (patient_id);

-- ---------------------------------------------------------------------------
-- Helper functions (used by RLS policies)
-- ---------------------------------------------------------------------------

create or replace function public.is_doctor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.doctors where profile_id = (select auth.uid())
  );
$$;

-- A doctor can see a patient's history only if the patient booked them
-- and agreed to share it.
create or replace function public.doctor_can_see_patient(target_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.appointments a
    where a.patient_id = target_patient
      and a.doctor_id = (select auth.uid())
      and a.share_history
      and a.status <> 'cancelled'
  );
$$;

revoke execute on function public.is_doctor() from public, anon;
revoke execute on function public.doctor_can_see_patient(uuid) from public, anon;
grant execute on function public.is_doctor() to authenticated;
grant execute on function public.doctor_can_see_patient(uuid) to authenticated;

-- Create a profile row for every new sign-up. Everyone starts as a patient.
-- Doctor accounts are promoted on the server (service role) by inserting into
-- public.doctors and setting role = 'doctor', so users cannot make themselves doctors.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Patients may edit their own profile but not their role.
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and current_user not in ('service_role', 'postgres') then
    raise exception 'role can only be changed by the server';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

-- ---------------------------------------------------------------------------
-- Patient's current list, with the latest doctor decision for each medicine.
-- security_invoker so the caller's RLS applies.
-- ---------------------------------------------------------------------------

create view public.patient_medication_list
with (security_invoker = true)
as
select
  m.id as medication_id,
  m.patient_id,
  m.name_as_written,
  dp.brand_name,
  m.dose,
  m.frequency,
  m.dose_times,
  m.instructions,
  m.status,
  p.source,
  coalesce(nullif(d.full_name, ''), p.external_doctor_name) as prescribed_by,
  latest.decision,
  latest.note as decision_note,
  latest.decided_at
from public.medications m
join public.prescriptions p on p.id = m.prescription_id
left join public.drug_products dp on dp.id = m.drug_product_id
left join public.profiles d on d.id = p.doctor_id
left join lateral (
  select md.decision, md.note, md.decided_at
  from public.medication_decisions md
  where md.medication_id = m.id
  order by md.decided_at desc
  limit 1
) latest on true;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.doctors enable row level security;
alter table public.appointments enable row level security;
alter table public.ingredients enable row level security;
alter table public.drug_products enable row level security;
alter table public.product_ingredients enable row level security;
alter table public.drug_interactions enable row level security;
alter table public.prescription_uploads enable row level security;
alter table public.prescriptions enable row level security;
alter table public.medications enable row level security;
alter table public.reconciliation_checks enable row level security;
alter table public.check_flags enable row level security;
alter table public.medication_decisions enable row level security;
alter table public.email_log enable row level security;

-- profiles
create policy "Users read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Anyone signed in reads doctor profiles" on public.profiles
  for select to authenticated using (role = 'doctor');
create policy "Doctors read their patients' profiles" on public.profiles
  for select to authenticated using (public.doctor_can_see_patient(id));
create policy "Users update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- doctors (list is public to signed-in users for booking)
create policy "Signed-in users read doctors" on public.doctors
  for select to authenticated using (true);
create policy "Doctors update own record" on public.doctors
  for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

-- appointments
create policy "Patients and doctors read their appointments" on public.appointments
  for select to authenticated
  using (patient_id = (select auth.uid()) or doctor_id = (select auth.uid()));
create policy "Patients book appointments" on public.appointments
  for insert to authenticated
  with check (patient_id = (select auth.uid()) and status = 'requested');
create policy "Patients and doctors update their appointments" on public.appointments
  for update to authenticated
  using (patient_id = (select auth.uid()) or doctor_id = (select auth.uid()))
  with check (patient_id = (select auth.uid()) or doctor_id = (select auth.uid()));

-- drug reference data: read-only for signed-in users, written by the service role
create policy "Signed-in users read ingredients" on public.ingredients
  for select to authenticated using (true);
create policy "Signed-in users read drug products" on public.drug_products
  for select to authenticated using (true);
create policy "Signed-in users read product ingredients" on public.product_ingredients
  for select to authenticated using (true);
create policy "Signed-in users read interactions" on public.drug_interactions
  for select to authenticated using (true);

-- prescription_uploads
create policy "Patients manage own uploads" on public.prescription_uploads
  for all to authenticated
  using (patient_id = (select auth.uid()))
  with check (patient_id = (select auth.uid()));
create policy "Doctors read their patients' uploads" on public.prescription_uploads
  for select to authenticated using (public.doctor_can_see_patient(patient_id));

-- prescriptions
create policy "Patients read own prescriptions" on public.prescriptions
  for select to authenticated using (patient_id = (select auth.uid()));
create policy "Patients add prescriptions from photos" on public.prescriptions
  for insert to authenticated
  with check (patient_id = (select auth.uid()) and source = 'photo_upload');
create policy "Doctors read their patients' prescriptions" on public.prescriptions
  for select to authenticated using (public.doctor_can_see_patient(patient_id));
create policy "Doctors write prescriptions for their patients" on public.prescriptions
  for insert to authenticated
  with check (
    source = 'in_app'
    and doctor_id = (select auth.uid())
    and public.doctor_can_see_patient(patient_id)
  );

-- medications
create policy "Patients read own medications" on public.medications
  for select to authenticated using (patient_id = (select auth.uid()));
create policy "Patients add medications from their photo prescriptions" on public.medications
  for insert to authenticated
  with check (
    patient_id = (select auth.uid())
    and exists (
      select 1 from public.prescriptions p
      where p.id = prescription_id
        and p.patient_id = (select auth.uid())
        and p.source = 'photo_upload'
    )
  );
create policy "Patients confirm their photo medications" on public.medications
  for update to authenticated
  using (
    patient_id = (select auth.uid())
    and exists (
      select 1 from public.prescriptions p
      where p.id = prescription_id and p.source = 'photo_upload'
    )
  )
  with check (patient_id = (select auth.uid()));
create policy "Doctors read their patients' medications" on public.medications
  for select to authenticated using (public.doctor_can_see_patient(patient_id));
create policy "Doctors add medications to their prescriptions" on public.medications
  for insert to authenticated
  with check (
    public.doctor_can_see_patient(patient_id)
    and exists (
      select 1 from public.prescriptions p
      where p.id = prescription_id
        and p.doctor_id = (select auth.uid())
        and p.patient_id = medications.patient_id
    )
  );
create policy "Doctors update their patients' medications" on public.medications
  for update to authenticated
  using (public.doctor_can_see_patient(patient_id))
  with check (public.doctor_can_see_patient(patient_id));

-- reconciliation_checks (created by the server with the service role)
create policy "Patients read own reviewed checks" on public.reconciliation_checks
  for select to authenticated
  using (patient_id = (select auth.uid()) and status = 'reviewed');
create policy "Doctors read own checks" on public.reconciliation_checks
  for select to authenticated using (doctor_id = (select auth.uid()));
create policy "Doctors mark own checks reviewed" on public.reconciliation_checks
  for update to authenticated
  using (doctor_id = (select auth.uid()))
  with check (doctor_id = (select auth.uid()));

-- check_flags (created by the server with the service role)
create policy "Doctors read flags on own checks" on public.check_flags
  for select to authenticated
  using (exists (
    select 1 from public.reconciliation_checks c
    where c.id = check_id and c.doctor_id = (select auth.uid())
  ));
create policy "Patients read flags on own reviewed checks" on public.check_flags
  for select to authenticated
  using (exists (
    select 1 from public.reconciliation_checks c
    where c.id = check_id and c.patient_id = (select auth.uid()) and c.status = 'reviewed'
  ));

-- medication_decisions
create policy "Doctors decide on own checks" on public.medication_decisions
  for insert to authenticated
  with check (
    decided_by = (select auth.uid())
    and exists (
      select 1 from public.reconciliation_checks c
      where c.id = check_id and c.doctor_id = (select auth.uid())
    )
  );
create policy "Doctors change own decisions" on public.medication_decisions
  for update to authenticated
  using (decided_by = (select auth.uid()))
  with check (decided_by = (select auth.uid()));
create policy "Doctors read decisions for their patients" on public.medication_decisions
  for select to authenticated
  using (exists (
    select 1 from public.reconciliation_checks c
    where c.id = check_id and public.doctor_can_see_patient(c.patient_id)
  ));
create policy "Patients read decisions on own reviewed checks" on public.medication_decisions
  for select to authenticated
  using (exists (
    select 1 from public.reconciliation_checks c
    where c.id = check_id and c.patient_id = (select auth.uid()) and c.status = 'reviewed'
  ));

-- email_log
create policy "Patients read own email log" on public.email_log
  for select to authenticated using (patient_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage: private bucket for prescription photos, one folder per patient
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'prescription-photos',
  'prescription-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do nothing;

create policy "Patients upload own prescription photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'prescription-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Patients read own prescription photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'prescription-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Patients delete own prescription photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'prescription-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Doctors read their patients' prescription photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'prescription-photos'
    and exists (
      select 1 from public.appointments a
      where a.patient_id::text = (storage.foldername(name))[1]
        and a.doctor_id = (select auth.uid())
        and a.share_history
        and a.status <> 'cancelled'
    )
  );
