
-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.renta_estatus AS ENUM (
  'borrador', 'cotizada', 'autorizada', 'rechazada', 'activa', 'devuelta'
);

CREATE TYPE public.renta_periodicidad AS ENUM (
  'diaria', 'semanal', 'quincenal', 'mensual'
);

CREATE TYPE public.renta_renovacion_estatus AS ENUM (
  'pendiente', 'autorizada', 'rechazada'
);

CREATE TYPE public.renta_evento_tipo AS ENUM (
  'averia', 'inactividad', 'nota'
);

-- ============================================================
-- TABLE: obra_rentas
-- ============================================================
CREATE TABLE public.obra_rentas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  numero integer NOT NULL DEFAULT 0,
  equipo text NOT NULL,
  cantidad numeric NOT NULL DEFAULT 1,
  descripcion text,
  proveedor_id uuid REFERENCES public.terceros(id) ON DELETE RESTRICT,
  periodicidad public.renta_periodicidad,
  tarifa_unitaria numeric NOT NULL DEFAULT 0,
  deposito numeric NOT NULL DEFAULT 0,
  condiciones text,
  fecha_estimada_inicio date,
  fecha_llegada_real date,
  fecha_fin_programada date,
  fecha_devolucion_real date,
  dias_aviso_vencimiento integer NOT NULL DEFAULT 3,
  estatus public.renta_estatus NOT NULL DEFAULT 'borrador',
  rechazo_motivo text,
  creado_por uuid NOT NULL,
  cotizado_por uuid,
  cotizado_at timestamptz,
  autorizado_por uuid,
  autorizado_at timestamptz,
  rechazado_por uuid,
  rechazado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_rentas TO authenticated;
GRANT ALL ON public.obra_rentas TO service_role;

ALTER TABLE public.obra_rentas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see rentas in own company"
  ON public.obra_rentas FOR SELECT
  TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Director admin residente o supervisor gestionan rentas"
  ON public.obra_rentas FOR ALL
  TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      public.is_director_of(company_id)
      OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role)
      OR public.has_role(auth.uid(), company_id, 'supervisor'::public.app_role)
      OR public.is_member_of_obra(obra_id)
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND (
      public.is_director_of(company_id)
      OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role)
      OR public.has_role(auth.uid(), company_id, 'supervisor'::public.app_role)
      OR public.is_member_of_obra(obra_id)
    )
  );

CREATE TRIGGER update_obra_rentas_updated_at
  BEFORE UPDATE ON public.obra_rentas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_obra_rentas_obra ON public.obra_rentas(obra_id);
CREATE INDEX idx_obra_rentas_estatus ON public.obra_rentas(estatus);

-- ============================================================
-- TABLE: obra_renta_renovaciones
-- ============================================================
CREATE TABLE public.obra_renta_renovaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  renta_id uuid NOT NULL REFERENCES public.obra_rentas(id) ON DELETE CASCADE,
  numero integer NOT NULL DEFAULT 1,
  fecha_fin_anterior date NOT NULL,
  fecha_fin_nueva date NOT NULL,
  tarifa_nueva numeric,
  motivo text,
  estatus public.renta_renovacion_estatus NOT NULL DEFAULT 'pendiente',
  rechazo_motivo text,
  solicitado_por uuid NOT NULL,
  autorizado_por uuid,
  autorizado_at timestamptz,
  rechazado_por uuid,
  rechazado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_renta_renovaciones TO authenticated;
GRANT ALL ON public.obra_renta_renovaciones TO service_role;

ALTER TABLE public.obra_renta_renovaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see renovaciones in own company"
  ON public.obra_renta_renovaciones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.obra_rentas r
      WHERE r.id = renta_id AND r.company_id = public.current_company_id()
    )
  );

CREATE POLICY "Gestion renta renovaciones"
  ON public.obra_renta_renovaciones FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.obra_rentas r
      WHERE r.id = renta_id
        AND (
          public.is_director_of(r.company_id)
          OR public.has_role(auth.uid(), r.company_id, 'supervisor'::public.app_role)
          OR public.is_member_of_obra(r.obra_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.obra_rentas r
      WHERE r.id = renta_id
        AND (
          public.is_director_of(r.company_id)
          OR public.has_role(auth.uid(), r.company_id, 'supervisor'::public.app_role)
          OR public.is_member_of_obra(r.obra_id)
        )
    )
  );

CREATE INDEX idx_renta_renov_renta ON public.obra_renta_renovaciones(renta_id);

-- ============================================================
-- TABLE: obra_renta_eventos
-- ============================================================
CREATE TABLE public.obra_renta_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  renta_id uuid NOT NULL REFERENCES public.obra_rentas(id) ON DELETE CASCADE,
  tipo public.renta_evento_tipo NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date,
  descripcion text NOT NULL,
  evidencia_url text,
  creado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_renta_eventos TO authenticated;
GRANT ALL ON public.obra_renta_eventos TO service_role;

ALTER TABLE public.obra_renta_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see renta eventos in own company"
  ON public.obra_renta_eventos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.obra_rentas r
      WHERE r.id = renta_id AND r.company_id = public.current_company_id()
    )
  );

CREATE POLICY "Gestion renta eventos"
  ON public.obra_renta_eventos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.obra_rentas r
      WHERE r.id = renta_id
        AND (
          public.is_director_of(r.company_id)
          OR public.is_member_of_obra(r.obra_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.obra_rentas r
      WHERE r.id = renta_id
        AND (
          public.is_director_of(r.company_id)
          OR public.is_member_of_obra(r.obra_id)
        )
    )
  );

CREATE INDEX idx_renta_eventos_renta ON public.obra_renta_eventos(renta_id);

-- ============================================================
-- TABLE: obra_renta_pagos
-- ============================================================
CREATE TABLE public.obra_renta_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  renta_id uuid NOT NULL REFERENCES public.obra_rentas(id) ON DELETE CASCADE,
  periodo_inicio date NOT NULL,
  periodo_fin date NOT NULL,
  monto numeric NOT NULL DEFAULT 0,
  referencia text,
  pagado_at date NOT NULL DEFAULT CURRENT_DATE,
  notas text,
  creado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_renta_pagos TO authenticated;
GRANT ALL ON public.obra_renta_pagos TO service_role;

ALTER TABLE public.obra_renta_pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see renta pagos in own company"
  ON public.obra_renta_pagos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.obra_rentas r
      WHERE r.id = renta_id AND r.company_id = public.current_company_id()
    )
  );

CREATE POLICY "Gestion renta pagos"
  ON public.obra_renta_pagos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.obra_rentas r
      WHERE r.id = renta_id
        AND (
          public.is_director_of(r.company_id)
          OR public.has_role(auth.uid(), r.company_id, 'administrativo'::public.app_role)
          OR public.is_member_of_obra(r.obra_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.obra_rentas r
      WHERE r.id = renta_id
        AND (
          public.is_director_of(r.company_id)
          OR public.has_role(auth.uid(), r.company_id, 'administrativo'::public.app_role)
          OR public.is_member_of_obra(r.obra_id)
        )
    )
  );

CREATE INDEX idx_renta_pagos_renta ON public.obra_renta_pagos(renta_id);

NOTIFY pgrst, 'reload schema';
