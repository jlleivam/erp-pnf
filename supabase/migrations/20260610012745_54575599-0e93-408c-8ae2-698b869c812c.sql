
-- 1. Enum values
ALTER TYPE public.destajo_estimacion_estatus ADD VALUE IF NOT EXISTS 'autorizada';
ALTER TYPE public.destajo_estimacion_estatus ADD VALUE IF NOT EXISTS 'rechazada';
ALTER TYPE public.destajo_estimacion_estatus ADD VALUE IF NOT EXISTS 'pagada';

-- 2. CxP estatus enum
DO $$ BEGIN
  CREATE TYPE public.cxp_estatus AS ENUM ('pendiente','parcial','pagada','cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cxp_beneficiario_tipo AS ENUM ('trabajador','tercero');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Tabla cuentas_por_pagar
CREATE TABLE IF NOT EXISTS public.cuentas_por_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  folio text NOT NULL,
  fecha_emision date NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento date,
  beneficiario_tipo public.cxp_beneficiario_tipo NOT NULL,
  beneficiario_id uuid NOT NULL,
  beneficiario_nombre text NOT NULL,
  concepto text NOT NULL,
  origen_tipo text NOT NULL,
  origen_id uuid,
  monto_total numeric(14,2) NOT NULL CHECK (monto_total > 0),
  monto_pagado numeric(14,2) NOT NULL DEFAULT 0 CHECK (monto_pagado >= 0),
  saldo numeric(14,2) GENERATED ALWAYS AS (monto_total - monto_pagado) STORED,
  estatus public.cxp_estatus NOT NULL DEFAULT 'pendiente',
  creado_por uuid NOT NULL REFERENCES auth.users(id),
  cancelado_at timestamptz,
  cancelado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelacion_motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, folio)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cuentas_por_pagar TO authenticated;
GRANT ALL ON public.cuentas_por_pagar TO service_role;

ALTER TABLE public.cuentas_por_pagar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Director o admin gestiona CxP"
  ON public.cuentas_por_pagar
  FOR ALL
  TO authenticated
  USING (
    company_id = current_company_id()
    AND (is_director_of(company_id) OR has_role(auth.uid(), company_id, 'administrativo'::app_role))
  )
  WITH CHECK (
    company_id = current_company_id()
    AND (is_director_of(company_id) OR has_role(auth.uid(), company_id, 'administrativo'::app_role))
  );

CREATE POLICY "Miembros de obra ven CxP de su obra"
  ON public.cuentas_por_pagar
  FOR SELECT
  TO authenticated
  USING (
    company_id = current_company_id()
    AND obra_id IS NOT NULL
    AND is_member_of_obra(obra_id)
  );

CREATE INDEX idx_cxp_company_estatus ON public.cuentas_por_pagar (company_id, estatus);
CREATE INDEX idx_cxp_origen ON public.cuentas_por_pagar (origen_tipo, origen_id);
CREATE INDEX idx_cxp_obra ON public.cuentas_por_pagar (obra_id);

CREATE TRIGGER update_cuentas_por_pagar_updated_at
  BEFORE UPDATE ON public.cuentas_por_pagar
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Folio CxP
CREATE OR REPLACE FUNCTION public.siguiente_folio_cxp(_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yr int := EXTRACT(YEAR FROM now())::int;
  next_n int;
BEGIN
  SELECT COALESCE(MAX(
    NULLIF(substring(folio FROM '^CxP-' || yr::text || '-(\d+)$'), '')::int
  ), 0) + 1
    INTO next_n
    FROM public.cuentas_por_pagar
    WHERE company_id = _company_id
      AND folio LIKE 'CxP-' || yr::text || '-%';
  RETURN 'CxP-' || yr::text || '-' || lpad(next_n::text, 4, '0');
END;
$$;

-- 5. Columnas nuevas en obra_destajo_estimaciones
ALTER TABLE public.obra_destajo_estimaciones
  ADD COLUMN IF NOT EXISTS autorizada_at timestamptz,
  ADD COLUMN IF NOT EXISTS autorizada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rechazada_at timestamptz,
  ADD COLUMN IF NOT EXISTS rechazada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rechazo_motivo text,
  ADD COLUMN IF NOT EXISTS cxp_id uuid REFERENCES public.cuentas_por_pagar(id) ON DELETE SET NULL;

-- 6. cxp_id en pagos
ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS cxp_id uuid REFERENCES public.cuentas_por_pagar(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pagos_cxp ON public.pagos (cxp_id);
