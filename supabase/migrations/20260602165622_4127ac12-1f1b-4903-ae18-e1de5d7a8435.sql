-- Enum para tipo de movimiento dentro de un renglón
DO $$ BEGIN
  CREATE TYPE public.presupuesto_movimiento AS ENUM ('renglon','modificacion','adicion','eliminacion');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.obra_presupuesto_renglones
  ADD COLUMN IF NOT EXISTS tipo_movimiento public.presupuesto_movimiento NOT NULL DEFAULT 'renglon',
  ADD COLUMN IF NOT EXISTS importe_delta numeric NOT NULL DEFAULT 0;
