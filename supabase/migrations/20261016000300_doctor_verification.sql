-- Doctor verification: a doctor applies, an admin approves or rejects.
-- Only approved doctors can be booked or see any patient data.
--
-- Applying and approving both run on the server with the service role, after
-- the server has checked who is asking. There is no client write path for
-- verification fields.
--
-- Create the first admin by hand (SQL editor or CLI):
--   update public.profiles set role = 'admin' where email = 'admin@example.com';

create type public.verification_status as enum ('pending', 'approved', 'rejected');

alter table public.doctors
  add column verification_status public.verification_status not null default 'pending',
  add column verified_by uuid references public.profiles (id) on delete set null,
  add column verified_at timestamptz,
  add column rejection_reason text;

create index doctors_verification_status_idx on public.doctors (verification_status);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function private.is_approved_doctor(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.doctors
    where profile_id = target and verification_status = 'approved'
  );
$$;

revoke execute on function private.is_admin() from public, anon;
revoke execute on function private.is_approved_doctor(uuid) from public, anon;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_approved_doctor(uuid) to authenticated;

-- Doctor access to a patient now also requires the doctor to be approved.
create or replace function private.doctor_can_see_patient(target_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.appointments a
    join public.doctors d on d.profile_id = a.doctor_id
    where a.patient_id = target_patient
      and a.doctor_id = (select auth.uid())
      and d.verification_status = 'approved'
      and a.share_history
      and a.status <> 'cancelled'
  );
$$;

create or replace function private.is_doctor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.doctors
    where profile_id = (select auth.uid()) and verification_status = 'approved'
  );
$$;

-- doctors: only approved doctors are listed for booking. A doctor always sees
-- their own record (to know their status); admins see everyone.
drop policy "Signed-in users read doctors" on public.doctors;
drop policy "Doctors update own record" on public.doctors;

create policy "Read approved, own or (admin) all doctors" on public.doctors
  for select to authenticated
  using (
    verification_status = 'approved'
    or profile_id = (select auth.uid())
    or (select private.is_admin())
  );

-- profiles: approved doctors are visible for booking; admins see all profiles.
drop policy "Anyone signed in reads doctor profiles" on public.profiles;

create policy "Anyone signed in reads approved doctor profiles" on public.profiles
  for select to authenticated
  using (role = 'doctor' and private.is_approved_doctor(id));

create policy "Admins read all profiles" on public.profiles
  for select to authenticated
  using ((select private.is_admin()));

-- appointments: patients can only book approved doctors.
drop policy "Patients book appointments" on public.appointments;

create policy "Patients book approved doctors" on public.appointments
  for insert to authenticated
  with check (
    patient_id = (select auth.uid())
    and status = 'requested'
    and private.is_approved_doctor(doctor_id)
  );
