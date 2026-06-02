-- Enums
CREATE TYPE public.destajo_doc_estatus AS ENUM ('borrador','enviado','autorizado','rechazado');
CREATE TYPE public.destajo_presupuesto_tipo AS ENUM ('base','adenda');
CREATE TYPE public.destajo_estimacion_estatus AS ENUM ('borrador','cerrada');

-- ============================================================
-- obra_destajos: cabecera
-- ============================================================
CREATE TABLE public.obra_destajos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL,
  company_id uuid NOT NULL,
  destajista_id uuid NOT NULL,
  numero integer NOT NULL DEFAULT 0,
  nombre text NOT NULL,
  descripcion text,
  estatus public.destajo_doc_estatus NOT NULL DEFAULT 'borrador',
  monto_total numeric NOT NULL DEFAULT 0,
  creado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_obra_destajos_obra ON public.obra_destajos(obra_id);
CREATE INDEX idx_obra_destajos_company ON public.obra_destajos(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_destajos TO authenticated;
GRANT ALL ON public.obra_destajos TO service_role;
ALTER TABLE public.obra_destajos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see destajos in own company"
ON public.obra_destajos FOR SELECT TO authenticated
USING (company_id = current_company_id());

CREATE POLICY "Director admin residente o supervisor gestionan destajos"
ON public.obra_destajos FOR ALL TO authenticated
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

CREATE TRIGGER update_obra_destajos_updated_at
BEFORE UPDATE ON public.obra_destajos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- obra_destajo_presupuestos: base + adendas
-- ============================================================
CREATE TABLE public.obra_destajo_presupuestos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destajo_id uuid NOT NULL,
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
CREATE INDEX idx_destajo_presupuestos_destajo ON public.obra_destajo_presupuestos(destajo_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_destajo_presupuestos TO authenticated;
GRANT ALL ON public.obra_destajo_presupuestos TO service_role;
ALTER TABLE public.obra_destajo_presupuestos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see destajo presupuestos in own company"
ON public.obra_destajo_presupuestos FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.obra_destajos d
  WHERE d.id = obra_destajo_presupuestos.destajo_id
    AND d.company_id = current_company_id()
));

CREATE POLICY "Gestion destajo presupuestos"
ON public.obra_destajo_presupuestos FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.obra_destajos d
  WHERE d.id = obra_destajo_presupuestos.destajo_id
    AND (
      is_director_of(d.company_id)
      OR has_role(auth.uid(), d.company_id, 'supervisor'::app_role)
      OR is_member_of_obra(d.obra_id)
    )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.obra_destajos d
  WHERE d.id = obra_destajo_presupuestos.destajo_id
    AND (
      is_director_of(d.company_id)
      OR has_role(auth.uid(), d.company_id, 'supervisor'::app_role)
      OR is_member_of_obra(d.obra_id)
    )
));

CREATE TRIGGER update_destajo_presupuestos_updated_at
BEFORE UPDATE ON public.obra_destajo_presupuestos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- obra_destajo_renglones: WBS
-- ============================================================
CREATE TABLE public.obra_destajo_renglones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_destajo_id uuid NOT NULL,
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
CREATE INDEX idx_destajo_renglones_presupuesto ON public.obra_destajo_renglones(presupuesto_destajo_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_destajo_renglones TO authenticated;
GRANT ALL ON public.obra_destajo_renglones TO service_role;
ALTER TABLE public.obra_destajo_renglones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see destajo renglones in own company"
ON public.obra_destajo_renglones FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.obra_destajo_presupuestos p
  JOIN public.obra_destajos d ON d.id = p.destajo_id
  WHERE p.id = obra_destajo_renglones.presupuesto_destajo_id
    AND d.company_id = current_company_id()
));

CREATE POLICY "Gestion destajo renglones"
ON public.obra_destajo_renglones FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.obra_destajo_presupuestos p
  JOIN public.obra_destajos d ON d.id = p.destajo_id
  WHERE p.id = obra_destajo_renglones.presupuesto_destajo_id
    AND (
      is_director_of(d.company_id)
      OR has_role(auth.uid(), d.company_id, 'supervisor'::app_role)
      OR is_member_of_obra(d.obra_id)
    )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.obra_destajo_presupuestos p
  JOIN public.obra_destajos d ON d.id = p.destajo_id
  WHERE p.id = obra_destajo_renglones.presupuesto_destajo_id
    AND (
      is_director_of(d.company_id)
      OR has_role(auth.uid(), d.company_id, 'supervisor'::app_role)
      OR is_member_of_obra(d.obra_id)
    )
));

-- ============================================================
-- obra_destajo_trabajadores
-- ============================================================
CREATE TABLE public.obra_destajo_trabajadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destajo_id uuid NOT NULL,
  trabajador_id uuid NOT NULL,
  asignado_at timestamptz NOT NULL DEFAULT now(),
  asignado_por uuid NOT NULL,
  desasignado_at timestamptz,
  desasignado_por uuid
);
CREATE INDEX idx_destajo_trabajadores_destajo ON public.obra_destajo_trabajadores(destajo_id);
CREATE INDEX idx_destajo_trabajadores_trab ON public.obra_destajo_trabajadores(trabajador_id);
-- Exclusividad: solo una asignación activa por trabajador
CREATE UNIQUE INDEX uniq_trab_activo_destajo
  ON public.obra_destajo_trabajadores(trabajador_id)
  WHERE desasignado_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_destajo_trabajadores TO authenticated;
GRANT ALL ON public.obra_destajo_trabajadores TO service_role;
ALTER TABLE public.obra_destajo_trabajadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see destajo trabajadores in own company"
ON public.obra_destajo_trabajadores FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.obra_destajos d
  WHERE d.id = obra_destajo_trabajadores.destajo_id
    AND d.company_id = current_company_id()
));

CREATE POLICY "Gestion destajo trabajadores"
ON public.obra_destajo_trabajadores FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.obra_destajos d
  WHERE d.id = obra_destajo_trabajadores.destajo_id
    AND (
      is_director_of(d.company_id)
      OR is_member_of_obra(d.obra_id)
    )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.obra_destajos d
  WHERE d.id = obra_destajo_trabajadores.destajo_id
    AND (
      is_director_of(d.company_id)
      OR is_member_of_obra(d.obra_id)
    )
));

-- ============================================================
-- obra_destajo_estimaciones
-- ============================================================
CREATE TABLE public.obra_destajo_estimaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destajo_id uuid NOT NULL,
  company_id uuid NOT NULL,
  numero integer NOT NULL DEFAULT 0,
  semana_inicio date NOT NULL,
  semana_fin date NOT NULL,
  estatus public.destajo_estimacion_estatus NOT NULL DEFAULT 'borrador',
  monto_total numeric NOT NULL DEFAULT 0,
  creado_por uuid NOT NULL,
  cerrada_at timestamptz,
  cerrada_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_destajo_estimaciones_destajo ON public.obra_destajo_estimaciones(destajo_id);
CREATE UNIQUE INDEX uniq_destajo_estimacion_semana
  ON public.obra_destajo_estimaciones(destajo_id, semana_inicio);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_destajo_estimaciones TO authenticated;
GRANT ALL ON public.obra_destajo_estimaciones TO service_role;
ALTER TABLE public.obra_destajo_estimaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see destajo estimaciones in own company"
ON public.obra_destajo_estimaciones FOR SELECT TO authenticated
USING (company_id = current_company_id());

CREATE POLICY "Gestion destajo estimaciones"
ON public.obra_destajo_estimaciones FOR ALL TO authenticated
USING (
  company_id = current_company_id()
  AND EXISTS (
    SELECT 1 FROM public.obra_destajos d
    WHERE d.id = obra_destajo_estimaciones.destajo_id
      AND (is_director_of(d.company_id) OR is_member_of_obra(d.obra_id))
  )
)
WITH CHECK (
  company_id = current_company_id()
  AND EXISTS (
    SELECT 1 FROM public.obra_destajos d
    WHERE d.id = obra_destajo_estimaciones.destajo_id
      AND (is_director_of(d.company_id) OR is_member_of_obra(d.obra_id))
  )
);

CREATE TRIGGER update_destajo_estimaciones_updated_at
BEFORE UPDATE ON public.obra_destajo_estimaciones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- obra_destajo_estimacion_renglones
-- ============================================================
CREATE TABLE public.obra_destajo_estimacion_renglones (
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
CREATE INDEX idx_destajo_est_renglones_est ON public.obra_destajo_estimacion_renglones(estimacion_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_destajo_estimacion_renglones TO authenticated;
GRANT ALL ON public.obra_destajo_estimacion_renglones TO service_role;
ALTER TABLE public.obra_destajo_estimacion_renglones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see destajo estimacion renglones in own company"
ON public.obra_destajo_estimacion_renglones FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.obra_destajo_estimaciones e
  WHERE e.id = obra_destajo_estimacion_renglones.estimacion_id
    AND e.company_id = current_company_id()
));

CREATE POLICY "Gestion destajo estimacion renglones"
ON public.obra_destajo_estimacion_renglones FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.obra_destajo_estimaciones e
  JOIN public.obra_destajos d ON d.id = e.destajo_id
  WHERE e.id = obra_destajo_estimacion_renglones.estimacion_id
    AND e.estatus = 'borrador'
    AND (is_director_of(d.company_id) OR is_member_of_obra(d.obra_id))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.obra_destajo_estimaciones e
  JOIN public.obra_destajos d ON d.id = e.destajo_id
  WHERE e.id = obra_destajo_estimacion_renglones.estimacion_id
    AND e.estatus = 'borrador'
    AND (is_director_of(d.company_id) OR is_member_of_obra(d.obra_id))
));