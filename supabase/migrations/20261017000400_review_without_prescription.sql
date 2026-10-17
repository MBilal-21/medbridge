-- A doctor can review a patient's current list (STOP / CONTINUE / CHANGE)
-- without prescribing anything new, so a check may have no new prescription.
alter table public.reconciliation_checks alter column new_prescription_id drop not null;
