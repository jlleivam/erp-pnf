ALTER TABLE public.pagos DROP CONSTRAINT IF EXISTS pagos_origen_tipo_check;
ALTER TABLE public.pagos ADD CONSTRAINT pagos_origen_tipo_check
  CHECK (origen_tipo = ANY (ARRAY['oc'::text, 'nomina'::text, 'subcontrato'::text, 'renta'::text, 'destajo'::text, 'gasolina'::text, 'caja_chica'::text, 'cxp'::text]));