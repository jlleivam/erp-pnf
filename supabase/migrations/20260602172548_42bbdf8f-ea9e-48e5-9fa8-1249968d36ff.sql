
-- Enum para estatus
CREATE TYPE public.nomina_estatus AS ENUM ('borrador', 'cerrada');

-- Header semanal por obra
CREATE TABLE public.obra_nominas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id UUID NOT NULL,
  company_id UUID NOT NULL,
  numero INTEGER NOT NULL DEFAULT 0,
  semana_inicio DATE NOT NULL,
  semana_fin DATE NOT NULL,
  estatus public.nomina_estatus NOT NULL DEFAULT 'borrador',
  monto_total NUMERIC NOT NULL DEFAULT 0,
  creado_por UUID NOT NULL,
  cerrada_por UUID,
  cerrada_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (obra_id, semana_inicio)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_nominas TO authenticated;
GRANT ALL ON public.obra_nominas TO service_role;

ALTER TABLE public.obra_nominas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see nominas in own company"
  ON public.obra_nominas FOR SELECT TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "Director admin o residente gestionan nominas"
  ON public.obra_nominas FOR ALL TO authenticated
  USING (
    company_id = current_company_id()
    AND (
      is_director_of(company_id)
      OR has_role(auth.uid(), company_id, 'administrativo'::app_role)
      OR is_member_of_obra(obra_id)
    )
  )
  WITH CHECK (
    company_id = current_company_id()
    AND (
      is_director_of(company_id)
      OR has_role(auth.uid(), company_id, 'administrativo'::app_role)
      OR is_member_of_obra(obra_id)
    )
  );

CREATE TRIGGER update_obra_nominas_updated_at
  BEFORE UPDATE ON public.obra_nominas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Renglón = trabajador asignado a esa nómina
CREATE TABLE public.obra_nomina_renglones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nomina_id UUID NOT NULL REFERENCES public.obra_nominas(id) ON DELETE CASCADE,
  trabajador_id UUID NOT NULL,
  sueldo_diario_snapshot NUMERIC NOT NULL DEFAULT 0,
  multiplicador_extras NUMERIC NOT NULL DEFAULT 2,
  dias_trabajados NUMERIC NOT NULL DEFAULT 0,
  horas_extras_total NUMERIC NOT NULL DEFAULT 0,
  importe_jornadas NUMERIC NOT NULL DEFAULT 0,
  importe_extras NUMERIC NOT NULL DEFAULT 0,
  importe_total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (nomina_id, trabajador_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_nomina_renglones TO authenticated;
GRANT ALL ON public.obra_nomina_renglones TO service_role;

ALTER TABLE public.obra_nomina_renglones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see nomina renglones in own company"
  ON public.obra_nomina_renglones FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.obra_nominas n
      WHERE n.id = obra_nomina_renglones.nomina_id
        AND n.company_id = current_company_id()
    )
  );

CREATE POLICY "Director admin o residente gestionan renglones nomina"
  ON public.obra_nomina_renglones FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.obra_nominas n
      WHERE n.id = obra_nomina_renglones.nomina_id
        AND n.estatus = 'borrador'
        AND (
          is_director_of(n.company_id)
          OR has_role(auth.uid(), n.company_id, 'administrativo'::app_role)
          OR is_member_of_obra(n.obra_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.obra_nominas n
      WHERE n.id = obra_nomina_renglones.nomina_id
        AND n.estatus = 'borrador'
        AND (
          is_director_of(n.company_id)
          OR has_role(auth.uid(), n.company_id, 'administrativo'::app_role)
          OR is_member_of_obra(n.obra_id)
        )
    )
  );

CREATE INDEX idx_obra_nomina_renglones_trabajador
  ON public.obra_nomina_renglones (trabajador_id);

-- Asistencia día a día
CREATE TABLE public.obra_nomina_asistencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  renglon_id UUID NOT NULL REFERENCES public.obra_nomina_renglones(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  jornada NUMERIC NOT NULL DEFAULT 0,
  horas_extras NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (renglon_id, fecha),
  CHECK (jornada IN (0, 0.5, 1)),
  CHECK (horas_extras >= 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_nomina_asistencias TO authenticated;
GRANT ALL ON public.obra_nomina_asistencias TO service_role;

ALTER TABLE public.obra_nomina_asistencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see nomina asistencias in own company"
  ON public.obra_nomina_asistencias FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.obra_nomina_renglones r
      JOIN public.obra_nominas n ON n.id = r.nomina_id
      WHERE r.id = obra_nomina_asistencias.renglon_id
        AND n.company_id = current_company_id()
    )
  );

CREATE POLICY "Director admin o residente gestionan asistencias"
  ON public.obra_nomina_asistencias FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.obra_nomina_renglones r
      JOIN public.obra_nominas n ON n.id = r.nomina_id
      WHERE r.id = obra_nomina_asistencias.renglon_id
        AND n.estatus = 'borrador'
        AND (
          is_director_of(n.company_id)
          OR has_role(auth.uid(), n.company_id, 'administrativo'::app_role)
          OR is_member_of_obra(n.obra_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.obra_nomina_renglones r
      JOIN public.obra_nominas n ON n.id = r.nomina_id
      WHERE r.id = obra_nomina_asistencias.renglon_id
        AND n.estatus = 'borrador'
        AND (
          is_director_of(n.company_id)
          OR has_role(auth.uid(), n.company_id, 'administrativo'::app_role)
          OR is_member_of_obra(n.obra_id)
        )
    )
  );

CREATE INDEX idx_obra_nomina_asistencias_fecha
  ON public.obra_nomina_asistencias (fecha);
