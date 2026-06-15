
-- 1) Columns on obra_subcontratos for anticipo + fondo de garantía
ALTER TABLE public.obra_subcontratos
  ADD COLUMN IF NOT EXISTS anticipo_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS anticipo_monto numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fondo_garantia_pct numeric NOT NULL DEFAULT 0;

ALTER TABLE public.obra_subcontratos
  DROP CONSTRAINT IF EXISTS obra_subcontratos_anticipo_pct_range;
ALTER TABLE public.obra_subcontratos
  ADD CONSTRAINT obra_subcontratos_anticipo_pct_range
  CHECK (anticipo_pct >= 0 AND anticipo_pct <= 100);

ALTER TABLE public.obra_subcontratos
  DROP CONSTRAINT IF EXISTS obra_subcontratos_fondo_pct_range;
ALTER TABLE public.obra_subcontratos
  ADD CONSTRAINT obra_subcontratos_fondo_pct_range
  CHECK (fondo_garantia_pct >= 0 AND fondo_garantia_pct <= 100);

-- 2) Columns on obra_subcontrato_estimaciones (paralelo a destajos)
ALTER TABLE public.obra_subcontrato_estimaciones
  ADD COLUMN IF NOT EXISTS amortizacion_anticipo numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retencion_fondo numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS liberacion_fondo numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monto_neto numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS autorizada_at timestamptz,
  ADD COLUMN IF NOT EXISTS autorizada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rechazada_at timestamptz,
  ADD COLUMN IF NOT EXISTS rechazada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rechazo_motivo text,
  ADD COLUMN IF NOT EXISTS cxp_id uuid REFERENCES public.cuentas_por_pagar(id) ON DELETE SET NULL;

-- 3) Tabla nueva: anticipos de subcontratos
CREATE TABLE IF NOT EXISTS public.obra_subcontrato_anticipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontrato_id uuid NOT NULL REFERENCES public.obra_subcontratos(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  monto numeric NOT NULL DEFAULT 0,
  metodo_pago text,
  referencia text,
  pagado boolean NOT NULL DEFAULT false,
  pagado_at timestamptz,
  pagado_por uuid REFERENCES auth.users(id),
  solicitado_at timestamptz,
  solicitado_por uuid REFERENCES auth.users(id),
  solicitud_notas text,
  folio text,
  creado_por uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT obra_subcontrato_anticipos_unique_subcontrato UNIQUE (subcontrato_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_subcontrato_anticipos TO authenticated;
GRANT ALL ON public.obra_subcontrato_anticipos TO service_role;

ALTER TABLE public.obra_subcontrato_anticipos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gestion subcontrato anticipos" ON public.obra_subcontrato_anticipos;
CREATE POLICY "Gestion subcontrato anticipos"
  ON public.obra_subcontrato_anticipos
  TO authenticated
  USING (
    (company_id = public.current_company_id()) AND EXISTS (
      SELECT 1 FROM public.obra_subcontratos d
      WHERE d.id = obra_subcontrato_anticipos.subcontrato_id
        AND (public.is_director_of(d.company_id) OR public.is_member_of_obra(d.obra_id))
    )
  )
  WITH CHECK (
    (company_id = public.current_company_id()) AND EXISTS (
      SELECT 1 FROM public.obra_subcontratos d
      WHERE d.id = obra_subcontrato_anticipos.subcontrato_id
        AND (public.is_director_of(d.company_id) OR public.is_member_of_obra(d.obra_id))
    )
  );

DROP POLICY IF EXISTS "Users see subcontrato anticipos in own company" ON public.obra_subcontrato_anticipos;
CREATE POLICY "Users see subcontrato anticipos in own company"
  ON public.obra_subcontrato_anticipos
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE INDEX IF NOT EXISTS idx_subcontrato_anticipos_subcontrato ON public.obra_subcontrato_anticipos(subcontrato_id);
CREATE INDEX IF NOT EXISTS idx_subcontrato_anticipos_company ON public.obra_subcontrato_anticipos(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS obra_subcontrato_anticipos_company_folio_uniq ON public.obra_subcontrato_anticipos(company_id, folio) WHERE folio IS NOT NULL;

DROP TRIGGER IF EXISTS update_obra_subcontrato_anticipos_updated_at ON public.obra_subcontrato_anticipos;
CREATE TRIGGER update_obra_subcontrato_anticipos_updated_at
  BEFORE UPDATE ON public.obra_subcontrato_anticipos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) RPC para folio (AS-yyyy-####)
CREATE OR REPLACE FUNCTION public.siguiente_folio_anticipo_subcontrato(_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  yr int := EXTRACT(YEAR FROM now())::int;
  next_n int;
BEGIN
  SELECT COALESCE(MAX(
    NULLIF(substring(folio FROM '^AS-' || yr::text || '-(\d+)$'), '')::int
  ), 0) + 1
    INTO next_n
    FROM public.obra_subcontrato_anticipos
    WHERE company_id = _company_id
      AND folio LIKE 'AS-' || yr::text || '-%';
  RETURN 'AS-' || yr::text || '-' || lpad(next_n::text, 4, '0');
END;
$function$;
