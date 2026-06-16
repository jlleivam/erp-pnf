
ALTER TYPE public.caja_chica_fondo_estatus ADD VALUE IF NOT EXISTS 'pendiente_autorizacion';
ALTER TYPE public.caja_chica_fondo_estatus ADD VALUE IF NOT EXISTS 'autorizado';
ALTER TYPE public.caja_chica_fondo_estatus ADD VALUE IF NOT EXISTS 'rechazado';

ALTER TYPE public.cxp_beneficiario_tipo ADD VALUE IF NOT EXISTS 'residente';

ALTER TABLE public.caja_chica_fondos
  ADD COLUMN IF NOT EXISTS autorizado_por uuid,
  ADD COLUMN IF NOT EXISTS autorizado_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS rechazado_por uuid,
  ADD COLUMN IF NOT EXISTS rechazado_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS motivo_rechazo text,
  ADD COLUMN IF NOT EXISTS cxp_id uuid REFERENCES public.cuentas_por_pagar(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_caja_chica_fondos_cxp_id ON public.caja_chica_fondos(cxp_id);
