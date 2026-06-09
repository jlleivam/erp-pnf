
ALTER TABLE public.obra_destajo_anticipos
  ADD COLUMN IF NOT EXISTS solicitado_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS solicitado_por uuid NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS solicitud_notas text NULL;
