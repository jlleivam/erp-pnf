ALTER TABLE public.obra_nomina_asistencias
  ADD COLUMN IF NOT EXISTS jornada_original numeric,
  ADD COLUMN IF NOT EXISTS horas_extras_original numeric,
  ADD COLUMN IF NOT EXISTS ajustado_por uuid,
  ADD COLUMN IF NOT EXISTS ajustado_at timestamptz,
  ADD COLUMN IF NOT EXISTS ajuste_motivo text;