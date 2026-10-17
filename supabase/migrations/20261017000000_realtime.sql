-- Broadcast changes so open pages update without a reload.
-- Realtime applies each table's RLS, so users only hear about rows they can read.

alter publication supabase_realtime add table
  public.doctors,
  public.appointments,
  public.prescription_uploads,
  public.prescriptions,
  public.medications,
  public.medication_decisions;
