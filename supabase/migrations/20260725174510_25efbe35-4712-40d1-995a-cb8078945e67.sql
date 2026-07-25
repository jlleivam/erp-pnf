
ALTER TABLE public.requisicion_insumos
  ALTER COLUMN insumo_id DROP NOT NULL,
  ALTER COLUMN cantidad DROP NOT NULL,
  ALTER COLUMN fecha_requerida DROP NOT NULL;
