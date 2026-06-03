CREATE TABLE public.obra_tareas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  obra_id uuid NOT NULL,
  titulo text NOT NULL,
  descripcion text,
  asignado_a uuid NOT NULL,
  creado_por uuid NOT NULL,
  fecha_limite date,
  estatus text NOT NULL DEFAULT 'pendiente'
    CHECK (estatus IN ('pendiente','en_progreso','completada','cancelada')),
  completada_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX obra_tareas_obra_asignado_estatus_idx ON public.obra_tareas (obra_id, asignado_a, estatus);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_tareas TO authenticated;
GRANT ALL ON public.obra_tareas TO service_role;

ALTER TABLE public.obra_tareas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver tareas de obra" ON public.obra_tareas FOR SELECT TO authenticated
USING (company_id = public.current_company_id()
  AND (public.is_director_of(company_id) OR public.is_member_of_obra(obra_id)));

CREATE POLICY "Crear tareas" ON public.obra_tareas FOR INSERT TO authenticated
WITH CHECK (company_id = public.current_company_id()
  AND (public.is_director_of(company_id) OR public.is_member_of_obra(obra_id))
  AND creado_por = auth.uid());

CREATE POLICY "Actualizar tareas" ON public.obra_tareas FOR UPDATE TO authenticated
USING (company_id = public.current_company_id()
  AND (public.is_director_of(company_id) OR public.is_member_of_obra(obra_id) OR asignado_a = auth.uid()))
WITH CHECK (company_id = public.current_company_id());

CREATE POLICY "Borrar tareas" ON public.obra_tareas FOR DELETE TO authenticated
USING (public.is_director_of(company_id) OR creado_por = auth.uid());

CREATE TRIGGER update_obra_tareas_updated_at
  BEFORE UPDATE ON public.obra_tareas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();