-- ============================================================
-- obra_subcontratos
-- ============================================================
CREATE TABLE public.obra_subcontratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  obra_id uuid NOT NULL,
  contratista_id uuid NOT NULL,
  creado_por uuid NOT NULL,
  numero integer NOT NULL DEFAULT 0,
  nombre text NOT NULL,
  descripcion text,
  estatus public.destajo_doc_estatus NOT NULL DEFAULT 'borrador',
  monto_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_subcontratos TO authenticated;
GRANT ALL ON public.obra_subcontratos TO service_role;

ALTER TABLE public.obra_subcontratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Director admin residente o supervisor gestionan subcontratos"
ON public.obra_subcontratos
FOR ALL
TO authenticated
USING (
  company_id = current_company_id()
  AND (
    is_director_of(company_id)
    OR has_role(auth.uid(), company_id, 'supervisor'::app_role)
    OR is_member_of_obra(obra_id)
  )
)
WITH CHECK (
  company_id = current_company_id()
  AND (
    is_director_of(company_id)
    OR has_role(auth.uid(), company_id, 'supervisor'::app_role)
    OR is_member_of_obra(obra_id)
  )
);

CREATE POLICY "Users see subcontratos in own company"
ON public.obra_subcontratos
FOR SELECT
TO authenticated
USING (company_id = current_company_id());

CREATE TRIGGER update_obra_subcontratos_updated_at
BEFORE UPDATE ON public.obra_subcontratos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- obra_subcontrato_presupuestos
-- ============================================================
CREATE TABLE public.obra_subcontrato_presupuestos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontrato_id uuid NOT NULL,
  tipo public.destajo_presupuesto_tipo NOT NULL,
  numero integer NOT NULL DEFAULT 0,
  nombre text NOT NULL,
  descripcion text,
  estatus public.destajo_doc_estatus NOT NULL DEFAULT 'borrador',
  monto_total numeric NOT NULL DEFAULT 0,
  creado_por uuid NOT NULL,
  enviado_at timestamptz,
  enviado_por uuid,
  autorizado_at timestamptz,
  autorizado_por uuid,
  rechazado_at timestamptz,
  rechazado_por uuid,
  rechazo_motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_subcontrato_presupuestos TO authenticated;
GRANT ALL ON public.obra_subcontrato_presupuestos TO service_role;

ALTER TABLE public.obra_subcontrato_presupuestos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestion subcontrato presupuestos"
ON public.obra_subcontrato_presupuestos
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.obra_subcontratos d
  WHERE d.id = obra_subcontrato_presupuestos.subcontrato_id
    AND (
      is_director_of(d.company_id)
      OR has_role(auth.uid(), d.company_id, 'supervisor'::app_role)
      OR is_member_of_obra(d.obra_id)
    )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.obra_subcontratos d
  WHERE d.id = obra_subcontrato_presupuestos.subcontrato_id
    AND (
      is_director_of(d.company_id)
      OR has_role(auth.uid(), d.company_id, 'supervisor'::app_role)
      OR is_member_of_obra(d.obra_id)
    )
));

CREATE POLICY "Users see subcontrato presupuestos in own company"
ON public.obra_subcontrato_presupuestos
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.obra_subcontratos d
  WHERE d.id = obra_subcontrato_presupuestos.subcontrato_id
    AND d.company_id = current_company_id()
));

CREATE TRIGGER update_obra_subcontrato_presupuestos_updated_at
BEFORE UPDATE ON public.obra_subcontrato_presupuestos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- obra_subcontrato_renglones
-- ============================================================
CREATE TABLE public.obra_subcontrato_renglones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_subcontrato_id uuid NOT NULL,
  clave text NOT NULL,
  parent_clave text,
  nivel integer NOT NULL,
  es_grupo boolean NOT NULL DEFAULT false,
  concepto text NOT NULL,
  unidad text,
  cantidad numeric,
  precio_unitario numeric,
  importe numeric NOT NULL DEFAULT 0,
  tipo_movimiento public.presupuesto_movimiento NOT NULL DEFAULT 'renglon',
  importe_delta numeric NOT NULL DEFAULT 0,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_subcontrato_renglones TO authenticated;
GRANT ALL ON public.obra_subcontrato_renglones TO service_role;

ALTER TABLE public.obra_subcontrato_renglones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestion subcontrato renglones"
ON public.obra_subcontrato_renglones
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.obra_subcontrato_presupuestos p
  JOIN public.obra_subcontratos d ON d.id = p.subcontrato_id
  WHERE p.id = obra_subcontrato_renglones.presupuesto_subcontrato_id
    AND (
      is_director_of(d.company_id)
      OR has_role(auth.uid(), d.company_id, 'supervisor'::app_role)
      OR is_member_of_obra(d.obra_id)
    )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.obra_subcontrato_presupuestos p
  JOIN public.obra_subcontratos d ON d.id = p.subcontrato_id
  WHERE p.id = obra_subcontrato_renglones.presupuesto_subcontrato_id
    AND (
      is_director_of(d.company_id)
      OR has_role(auth.uid(), d.company_id, 'supervisor'::app_role)
      OR is_member_of_obra(d.obra_id)
    )
));

CREATE POLICY "Users see subcontrato renglones in own company"
ON public.obra_subcontrato_renglones
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.obra_subcontrato_presupuestos p
  JOIN public.obra_subcontratos d ON d.id = p.subcontrato_id
  WHERE p.id = obra_subcontrato_renglones.presupuesto_subcontrato_id
    AND d.company_id = current_company_id()
));

-- ============================================================
-- obra_subcontrato_estimaciones
-- ============================================================
CREATE TABLE public.obra_subcontrato_estimaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontrato_id uuid NOT NULL,
  company_id uuid NOT NULL,
  numero integer NOT NULL DEFAULT 0,
  semana_inicio date NOT NULL,
  semana_fin date NOT NULL,
  estatus public.destajo_estimacion_estatus NOT NULL DEFAULT 'borrador',
  monto_total numeric NOT NULL DEFAULT 0,
  creado_por uuid NOT NULL,
  cerrada_por uuid,
  cerrada_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_subcontrato_estimaciones TO authenticated;
GRANT ALL ON public.obra_subcontrato_estimaciones TO service_role;

ALTER TABLE public.obra_subcontrato_estimaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestion subcontrato estimaciones"
ON public.obra_subcontrato_estimaciones
FOR ALL
TO authenticated
USING (
  company_id = current_company_id()
  AND EXISTS (
    SELECT 1 FROM public.obra_subcontratos d
    WHERE d.id = obra_subcontrato_estimaciones.subcontrato_id
      AND (is_director_of(d.company_id) OR is_member_of_obra(d.obra_id))
  )
)
WITH CHECK (
  company_id = current_company_id()
  AND EXISTS (
    SELECT 1 FROM public.obra_subcontratos d
    WHERE d.id = obra_subcontrato_estimaciones.subcontrato_id
      AND (is_director_of(d.company_id) OR is_member_of_obra(d.obra_id))
  )
);

CREATE POLICY "Users see subcontrato estimaciones in own company"
ON public.obra_subcontrato_estimaciones
FOR SELECT
TO authenticated
USING (company_id = current_company_id());

CREATE TRIGGER update_obra_subcontrato_estimaciones_updated_at
BEFORE UPDATE ON public.obra_subcontrato_estimaciones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- obra_subcontrato_estimacion_renglones
-- ============================================================
CREATE TABLE public.obra_subcontrato_estimacion_renglones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimacion_id uuid NOT NULL,
  renglon_clave text NOT NULL,
  concepto text NOT NULL,
  unidad text,
  cantidad_vigente numeric NOT NULL DEFAULT 0,
  pu_vigente numeric NOT NULL DEFAULT 0,
  cantidad_ejecutada numeric NOT NULL DEFAULT 0,
  importe_ejecutado numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_subcontrato_estimacion_renglones TO authenticated;
GRANT ALL ON public.obra_subcontrato_estimacion_renglones TO service_role;

ALTER TABLE public.obra_subcontrato_estimacion_renglones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestion subcontrato estimacion renglones"
ON public.obra_subcontrato_estimacion_renglones
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.obra_subcontrato_estimaciones e
  JOIN public.obra_subcontratos d ON d.id = e.subcontrato_id
  WHERE e.id = obra_subcontrato_estimacion_renglones.estimacion_id
    AND e.estatus = 'borrador'::destajo_estimacion_estatus
    AND (is_director_of(d.company_id) OR is_member_of_obra(d.obra_id))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.obra_subcontrato_estimaciones e
  JOIN public.obra_subcontratos d ON d.id = e.subcontrato_id
  WHERE e.id = obra_subcontrato_estimacion_renglones.estimacion_id
    AND e.estatus = 'borrador'::destajo_estimacion_estatus
    AND (is_director_of(d.company_id) OR is_member_of_obra(d.obra_id))
));

CREATE POLICY "Users see subcontrato estimacion renglones in own company"
ON public.obra_subcontrato_estimacion_renglones
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.obra_subcontrato_estimaciones e
  WHERE e.id = obra_subcontrato_estimacion_renglones.estimacion_id
    AND e.company_id = current_company_id()
));
