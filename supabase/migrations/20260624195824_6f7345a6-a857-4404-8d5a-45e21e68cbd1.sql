
-- 1. Enums
CREATE TYPE public.nomina_oficina_periodicidad AS ENUM ('semanal','quincenal','mensual');
CREATE TYPE public.gasto_oficina_tipo AS ENUM ('nomina_oficina','servicio','papeleria','otro');
CREATE TYPE public.gasto_oficina_estatus AS ENUM ('pendiente_aprobacion','aprobada','rechazada','pagada','cancelada');

-- 2. Trabajadores: marca de personal de oficina
ALTER TABLE public.trabajadores
  ADD COLUMN es_personal_oficina boolean NOT NULL DEFAULT false,
  ADD COLUMN periodicidad_pago public.nomina_oficina_periodicidad,
  ADD COLUMN sueldo_periodo numeric(14,2);

-- 3. Tabla gastos_oficina
CREATE TABLE public.gastos_oficina (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  folio text NOT NULL,
  tipo public.gasto_oficina_tipo NOT NULL,
  concepto text NOT NULL,
  proveedor_id uuid REFERENCES public.terceros(id) ON DELETE SET NULL,
  beneficiario_trabajador_id uuid REFERENCES public.trabajadores(id) ON DELETE SET NULL,
  periodo_inicio date,
  periodo_fin date,
  monto numeric(14,2) NOT NULL CHECK (monto > 0),
  fecha_gasto date NOT NULL DEFAULT current_date,
  fecha_requerida_pago date,
  notas text,
  evidencia_url text,
  estatus public.gasto_oficina_estatus NOT NULL DEFAULT 'pendiente_aprobacion',
  cxp_id uuid REFERENCES public.cuentas_por_pagar(id) ON DELETE SET NULL,
  motivo_rechazo text,
  solicitado_por uuid NOT NULL REFERENCES auth.users(id),
  aprobado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  aprobado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, folio)
);

CREATE INDEX idx_gastos_oficina_company_estatus ON public.gastos_oficina(company_id, estatus);
CREATE INDEX idx_gastos_oficina_cxp ON public.gastos_oficina(cxp_id);
CREATE UNIQUE INDEX uniq_nomina_oficina_periodo
  ON public.gastos_oficina (beneficiario_trabajador_id, periodo_inicio, periodo_fin)
  WHERE tipo = 'nomina_oficina' AND beneficiario_trabajador_id IS NOT NULL;

-- 4. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gastos_oficina TO authenticated;
GRANT ALL ON public.gastos_oficina TO service_role;

-- 5. RLS
ALTER TABLE public.gastos_oficina ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros de la empresa pueden ver gastos oficina"
  ON public.gastos_oficina FOR SELECT
  TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Miembros pueden capturar solicitudes"
  ON public.gastos_oficina FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND solicitado_por = auth.uid()
  );

CREATE POLICY "Director o admin gestiona gastos oficina"
  ON public.gastos_oficina FOR UPDATE
  TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (public.is_director_of(company_id) OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role))
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND (public.is_director_of(company_id) OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role))
  );

CREATE POLICY "Director o admin elimina gastos oficina"
  ON public.gastos_oficina FOR DELETE
  TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (public.is_director_of(company_id) OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role))
  );

-- 6. Trigger updated_at
CREATE TRIGGER trg_gastos_oficina_updated_at
  BEFORE UPDATE ON public.gastos_oficina
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Folio sequence function
CREATE OR REPLACE FUNCTION public.siguiente_folio_gasto_oficina(_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  yr int := EXTRACT(YEAR FROM now())::int;
  next_n int;
BEGIN
  SELECT COALESCE(MAX(
    NULLIF(substring(folio FROM '^GO-' || yr::text || '-(\d+)$'), '')::int
  ), 0) + 1
    INTO next_n
    FROM public.gastos_oficina
    WHERE company_id = _company_id
      AND folio LIKE 'GO-' || yr::text || '-%';
  RETURN 'GO-' || yr::text || '-' || lpad(next_n::text, 4, '0');
END;
$$;
