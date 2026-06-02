-- Estimaciones semanales (producción)

CREATE TYPE public.estimacion_estatus AS ENUM ('borrador', 'cerrada');

CREATE TABLE public.obra_estimaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL,
  company_id uuid NOT NULL,
  numero integer NOT NULL DEFAULT 0,
  semana_inicio date NOT NULL,
  semana_fin date NOT NULL,
  estatus public.estimacion_estatus NOT NULL DEFAULT 'borrador',
  monto_total numeric NOT NULL DEFAULT 0,
  creado_por uuid NOT NULL,
  cerrada_por uuid,
  cerrada_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT obra_estimaciones_obra_semana_unique UNIQUE (obra_id, semana_inicio)
);

CREATE INDEX idx_obra_estimaciones_obra ON public.obra_estimaciones(obra_id, semana_inicio DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_estimaciones TO authenticated;
GRANT ALL ON public.obra_estimaciones TO service_role;

ALTER TABLE public.obra_estimaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see estimaciones in own company"
  ON public.obra_estimaciones FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Director o residente gestionan estimaciones"
  ON public.obra_estimaciones FOR ALL TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (public.is_director_of(company_id) OR public.is_member_of_obra(obra_id))
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND (public.is_director_of(company_id) OR public.is_member_of_obra(obra_id))
  );

CREATE TRIGGER update_obra_estimaciones_updated_at
  BEFORE UPDATE ON public.obra_estimaciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.obra_estimacion_renglones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimacion_id uuid NOT NULL REFERENCES public.obra_estimaciones(id) ON DELETE CASCADE,
  renglon_clave text NOT NULL,
  concepto text NOT NULL,
  unidad text,
  cantidad_vigente numeric NOT NULL DEFAULT 0,
  pu_vigente numeric NOT NULL DEFAULT 0,
  cantidad_ejecutada numeric NOT NULL DEFAULT 0,
  importe_ejecutado numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT obra_estimacion_renglones_unique UNIQUE (estimacion_id, renglon_clave)
);

CREATE INDEX idx_obra_estimacion_renglones_est ON public.obra_estimacion_renglones(estimacion_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_estimacion_renglones TO authenticated;
GRANT ALL ON public.obra_estimacion_renglones TO service_role;

ALTER TABLE public.obra_estimacion_renglones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see estimacion renglones in own company"
  ON public.obra_estimacion_renglones FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.obra_estimaciones e
    WHERE e.id = obra_estimacion_renglones.estimacion_id
      AND e.company_id = public.current_company_id()
  ));

CREATE POLICY "Director o residente gestionan estimacion renglones"
  ON public.obra_estimacion_renglones FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.obra_estimaciones e
    WHERE e.id = obra_estimacion_renglones.estimacion_id
      AND e.estatus = 'borrador'
      AND (public.is_director_of(e.company_id) OR public.is_member_of_obra(e.obra_id))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.obra_estimaciones e
    WHERE e.id = obra_estimacion_renglones.estimacion_id
      AND e.estatus = 'borrador'
      AND (public.is_director_of(e.company_id) OR public.is_member_of_obra(e.obra_id))
  ));
