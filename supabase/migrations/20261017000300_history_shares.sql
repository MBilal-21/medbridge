-- Patients can share their medicine history with any approved doctor at any
-- time, not only through an appointment, and stop sharing whenever they like.

create table public.history_shares (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  doctor_id uuid not null references public.doctors (profile_id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (patient_id, doctor_id)
);

create index history_shares_doctor_id_idx on public.history_shares (doctor_id);

alter table public.history_shares enable row level security;

create policy "Patients read own shares" on public.history_shares
  for select to authenticated using (patient_id = (select auth.uid()));
create policy "Patients share with approved doctors" on public.history_shares
  for insert to authenticated
  with check (patient_id = (select auth.uid()) and private.is_approved_doctor(doctor_id));
create policy "Patients stop sharing" on public.history_shares
  for delete to authenticated using (patient_id = (select auth.uid()));
create policy "Doctors read shares with them" on public.history_shares
  for select to authenticated using (doctor_id = (select auth.uid()));

-- A doctor sees a patient's history through an open appointment the patient
-- shared, or through a direct share. Either way the doctor must be approved.
create or replace function private.doctor_can_see_patient(target_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.doctors d
    where d.profile_id = (select auth.uid())
      and d.verification_status = 'approved'
      and (
        exists (
          select 1 from public.appointments a
          where a.patient_id = target_patient
            and a.doctor_id = d.profile_id
            and a.share_history
            and a.status <> 'cancelled'
        )
        or exists (
          select 1 from public.history_shares s
          where s.patient_id = target_patient and s.doctor_id = d.profile_id
        )
      )
  );
$$;

-- The history shows what every doctor decided, so a doctor with access also
-- sees other doctors' finished reviews (not their unfinished ones).
create policy "Doctors read reviewed checks of their patients" on public.reconciliation_checks
  for select to authenticated
  using (status = 'reviewed' and private.doctor_can_see_patient(patient_id));

create policy "Doctors read photos shared with them" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'prescription-photos'
    and exists (
      select 1 from public.history_shares s
      join public.doctors d on d.profile_id = s.doctor_id
      where s.patient_id::text = (storage.foldername(name))[1]
        and s.doctor_id = (select auth.uid())
        and d.verification_status = 'approved'
    )
  );

alter publication supabase_realtime add table public.history_shares;
