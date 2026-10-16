-- Move RLS helpers and trigger functions out of the API-exposed public schema,
-- so they are not callable as /rest/v1/rpc/* endpoints. Policies and triggers
-- reference functions by id, so they keep working after the move.

create schema if not exists private;
grant usage on schema private to authenticated;

alter function public.is_doctor() set schema private;
alter function public.doctor_can_see_patient(uuid) set schema private;
alter function public.handle_new_user() set schema private;
alter function public.prevent_role_change() set schema private;

-- Trigger functions are never called directly.
revoke execute on function private.handle_new_user() from public, anon, authenticated;
revoke execute on function private.prevent_role_change() from public, anon, authenticated;
