-- The drug database's finding in words (e.g. "Warfarin with aspirin raises the
-- risk of serious bleeding."), shown to the doctor next to the AI explanation.
alter table public.check_flags add column finding text not null default '';

-- Live updates for the doctor's check review.
alter publication supabase_realtime add table public.reconciliation_checks, public.check_flags;
