ALTER TABLE public.caja_chica_gastos
  ADD COLUMN IF NOT EXISTS comprobante_reclasificado_de text,
  ADD COLUMN IF NOT EXISTS comprobante_reclasificado_motivo text,
  ADD COLUMN IF NOT EXISTS comprobante_reclasificado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS comprobante_reclasificado_at timestamptz;