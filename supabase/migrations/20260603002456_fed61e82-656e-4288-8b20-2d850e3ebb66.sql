-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.caja_chica_gasto_tipo_comprobante AS ENUM ('factura','nota','ninguno');
CREATE TYPE public.caja_chica_gasto_estatus AS ENUM ('borrador','solicitado','aprobado','rechazado','reembolsado');
CREATE TYPE public.caja_chica_reembolso_estatus AS ENUM ('solicitado','en_revision','enviado_admin','repuesto','rechazado');
CREATE TYPE public.caja_chica_fondo_estatus AS ENUM ('pendiente','entregado','cancelado');

-- ============================================================
-- TABLE: caja_chica_asignaciones
-- ============================================================
CREATE TABLE public.caja_chica_asignaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  obra_id uuid NOT NULL,
  residente_id uuid NOT NULL,
  monto_base numeric NOT NULL DEFAULT 0 CHECK (monto_base >= 0),
  activo boolean NOT NULL DEFAULT true,
  asignado_por uuid NOT NULL,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_caja_chica_asig_activa
  ON public.caja_chica_asignaciones (obra_id, residente_id) WHERE activo;
CREATE INDEX idx_caja_chica_asig_obra ON public.caja_chica_asignaciones (obra_id);

GRANT SELECT, INSERT, UPDATE ON public.caja_chica_asignaciones TO authenticated;
GRANT ALL ON public.caja_chica_asignaciones TO service_role;

ALTER TABLE public.caja_chica_asignaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see asignaciones in own company"
  ON public.caja_chica_asignaciones FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Director manages asignaciones"
  ON public.caja_chica_asignaciones FOR ALL TO authenticated
  USING (public.is_director_of(company_id))
  WITH CHECK (public.is_director_of(company_id));

CREATE TRIGGER trg_caja_chica_asig_updated
  BEFORE UPDATE ON public.caja_chica_asignaciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TABLE: caja_chica_fondos
-- ============================================================
CREATE TABLE public.caja_chica_fondos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  obra_id uuid NOT NULL,
  residente_id uuid NOT NULL,
  monto_solicitado numeric NOT NULL CHECK (monto_solicitado > 0),
  monto_entregado numeric,
  estatus public.caja_chica_fondo_estatus NOT NULL DEFAULT 'pendiente',
  solicitado_por uuid NOT NULL,
  solicitado_at timestamptz NOT NULL DEFAULT now(),
  entregado_por uuid,
  entregado_at timestamptz,
  cancelado_por uuid,
  cancelado_at timestamptz,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_caja_chica_fondos_obra ON public.caja_chica_fondos (obra_id, estatus);
CREATE INDEX idx_caja_chica_fondos_company ON public.caja_chica_fondos (company_id, estatus);

GRANT SELECT, INSERT, UPDATE ON public.caja_chica_fondos TO authenticated;
GRANT ALL ON public.caja_chica_fondos TO service_role;

ALTER TABLE public.caja_chica_fondos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see fondos in own company"
  ON public.caja_chica_fondos FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Insert fondos in own company"
  ON public.caja_chica_fondos FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND (
      public.is_director_of(company_id)
      OR public.has_role(auth.uid(), company_id, 'administrativo')
      OR public.is_member_of_obra(obra_id)
    )
  );

CREATE POLICY "Update fondos in own company"
  ON public.caja_chica_fondos FOR UPDATE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      public.is_director_of(company_id)
      OR public.has_role(auth.uid(), company_id, 'administrativo')
      OR public.is_member_of_obra(obra_id)
    )
  )
  WITH CHECK (company_id = public.current_company_id());

CREATE TRIGGER trg_caja_chica_fondos_updated
  BEFORE UPDATE ON public.caja_chica_fondos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TABLE: caja_chica_reembolsos
-- ============================================================
CREATE TABLE public.caja_chica_reembolsos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folio text NOT NULL,
  company_id uuid NOT NULL,
  obra_id uuid NOT NULL,
  residente_id uuid NOT NULL,
  semana_inicio date NOT NULL,
  semana_fin date NOT NULL,
  estatus public.caja_chica_reembolso_estatus NOT NULL DEFAULT 'solicitado',
  monto_solicitado numeric NOT NULL DEFAULT 0,
  monto_aprobado numeric NOT NULL DEFAULT 0,
  monto_reembolsado numeric,
  solicitado_por uuid NOT NULL,
  solicitado_at timestamptz NOT NULL DEFAULT now(),
  revisado_por uuid,
  revisado_at timestamptz,
  enviado_admin_at timestamptz,
  enviado_admin_por uuid,
  repuesto_por uuid,
  repuesto_at timestamptz,
  rechazado_por uuid,
  rechazado_at timestamptz,
  motivo_rechazo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_caja_chica_reembolso_folio UNIQUE (company_id, folio)
);
CREATE INDEX idx_caja_chica_reemb_obra ON public.caja_chica_reembolsos (obra_id, estatus);
CREATE INDEX idx_caja_chica_reemb_company ON public.caja_chica_reembolsos (company_id, estatus);

GRANT SELECT, INSERT, UPDATE ON public.caja_chica_reembolsos TO authenticated;
GRANT ALL ON public.caja_chica_reembolsos TO service_role;

ALTER TABLE public.caja_chica_reembolsos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see reembolsos in own company"
  ON public.caja_chica_reembolsos FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Insert reembolsos in own company"
  ON public.caja_chica_reembolsos FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND (
      public.is_director_of(company_id)
      OR public.is_member_of_obra(obra_id)
    )
  );

CREATE POLICY "Update reembolsos in own company"
  ON public.caja_chica_reembolsos FOR UPDATE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      public.is_director_of(company_id)
      OR public.has_role(auth.uid(), company_id, 'supervisor')
      OR public.has_role(auth.uid(), company_id, 'administrativo')
      OR public.is_member_of_obra(obra_id)
    )
  )
  WITH CHECK (company_id = public.current_company_id());

CREATE TRIGGER trg_caja_chica_reemb_updated
  BEFORE UPDATE ON public.caja_chica_reembolsos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TABLE: caja_chica_gastos
-- ============================================================
CREATE TABLE public.caja_chica_gastos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  obra_id uuid NOT NULL,
  residente_id uuid NOT NULL,
  reembolso_id uuid REFERENCES public.caja_chica_reembolsos(id) ON DELETE SET NULL,
  fecha date NOT NULL,
  concepto text NOT NULL,
  descripcion text,
  monto numeric NOT NULL CHECK (monto > 0),
  tipo_comprobante public.caja_chica_gasto_tipo_comprobante NOT NULL DEFAULT 'ninguno',
  evidencia_url text,
  estatus public.caja_chica_gasto_estatus NOT NULL DEFAULT 'borrador',
  revisado_por uuid,
  revisado_at timestamptz,
  motivo_rechazo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_caja_chica_gastos_obra ON public.caja_chica_gastos (obra_id, estatus);
CREATE INDEX idx_caja_chica_gastos_reemb ON public.caja_chica_gastos (reembolso_id);
CREATE INDEX idx_caja_chica_gastos_residente ON public.caja_chica_gastos (residente_id, estatus);

GRANT SELECT, INSERT, UPDATE ON public.caja_chica_gastos TO authenticated;
GRANT ALL ON public.caja_chica_gastos TO service_role;

ALTER TABLE public.caja_chica_gastos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see gastos in own company"
  ON public.caja_chica_gastos FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Insert gastos in own company"
  ON public.caja_chica_gastos FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND (
      public.is_director_of(company_id)
      OR public.is_member_of_obra(obra_id)
    )
  );

CREATE POLICY "Update gastos in own company"
  ON public.caja_chica_gastos FOR UPDATE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      public.is_director_of(company_id)
      OR public.has_role(auth.uid(), company_id, 'supervisor')
      OR public.is_member_of_obra(obra_id)
    )
  )
  WITH CHECK (company_id = public.current_company_id());

CREATE TRIGGER trg_caja_chica_gastos_updated
  BEFORE UPDATE ON public.caja_chica_gastos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- FUNCTION: siguiente_folio_caja_chica
-- ============================================================
CREATE OR REPLACE FUNCTION public.siguiente_folio_caja_chica(_company_id uuid)
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
    NULLIF(substring(folio FROM '^CC-' || yr::text || '-(\d+)$'), '')::int
  ), 0) + 1
    INTO next_n
    FROM public.caja_chica_reembolsos
    WHERE company_id = _company_id
      AND folio LIKE 'CC-' || yr::text || '-%';
  RETURN 'CC-' || yr::text || '-' || lpad(next_n::text, 4, '0');
END;
$$;