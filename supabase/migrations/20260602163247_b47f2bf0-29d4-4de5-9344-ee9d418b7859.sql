-- Estatus del presupuesto
CREATE TYPE public.presupuesto_estatus AS ENUM ('borrador', 'autorizado');
CREATE TYPE public.presupuesto_tipo AS ENUM ('base', 'adenda');

-- Encabezado de presupuesto (base o adenda)
CREATE TABLE public.obra_presupuestos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tipo public.presupuesto_tipo NOT NULL,
  numero integer NOT NULL DEFAULT 0,
  nombre text NOT NULL,
  descripcion text,
  estatus public.presupuesto_estatus NOT NULL DEFAULT 'borrador',
  monto_total numeric NOT NULL DEFAULT 0,
  autorizado_por uuid REFERENCES auth.users(id),
  autorizado_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Solo un base autorizado por obra
CREATE UNIQUE INDEX obra_presupuestos_base_autorizado_unique
  ON public.obra_presupuestos(obra_id)
  WHERE tipo = 'base' AND estatus = 'autorizado';

-- Numero unico de adenda por obra
CREATE UNIQUE INDEX obra_presupuestos_adenda_numero_unique
  ON public.obra_presupuestos(obra_id, numero)
  WHERE tipo = 'adenda';

CREATE INDEX idx_obra_presupuestos_obra ON public.obra_presupuestos(obra_id);

-- Renglones del presupuesto
CREATE TABLE public.obra_presupuesto_renglones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id uuid NOT NULL REFERENCES public.obra_presupuestos(id) ON DELETE CASCADE,
  clave text NOT NULL,
  nivel integer NOT NULL CHECK (nivel BETWEEN 1 AND 5),
  parent_clave text,
  concepto text NOT NULL,
  unidad text,
  cantidad numeric,
  precio_unitario numeric,
  importe numeric NOT NULL DEFAULT 0,
  es_grupo boolean NOT NULL DEFAULT false,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX obra_presupuesto_renglones_clave_unique
  ON public.obra_presupuesto_renglones(presupuesto_id, clave);
CREATE INDEX idx_obra_presupuesto_renglones_presupuesto
  ON public.obra_presupuesto_renglones(presupuesto_id, orden);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_presupuestos TO authenticated;
GRANT ALL ON public.obra_presupuestos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_presupuesto_renglones TO authenticated;
GRANT ALL ON public.obra_presupuesto_renglones TO service_role;

-- RLS
ALTER TABLE public.obra_presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_presupuesto_renglones ENABLE ROW LEVEL SECURITY;

-- obra_presupuestos: lectura por miembros de la empresa, escritura solo Director
CREATE POLICY "Users see presupuestos in own company"
  ON public.obra_presupuestos FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Director manages presupuestos"
  ON public.obra_presupuestos FOR ALL TO authenticated
  USING (public.is_director_of(company_id))
  WITH CHECK (public.is_director_of(company_id));

-- obra_presupuesto_renglones: heredan permisos del encabezado
CREATE POLICY "Users see renglones in own company"
  ON public.obra_presupuesto_renglones FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.obra_presupuestos p
    WHERE p.id = obra_presupuesto_renglones.presupuesto_id
      AND p.company_id = public.current_company_id()
  ));

CREATE POLICY "Director manages renglones"
  ON public.obra_presupuesto_renglones FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.obra_presupuestos p
    WHERE p.id = obra_presupuesto_renglones.presupuesto_id
      AND public.is_director_of(p.company_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.obra_presupuestos p
    WHERE p.id = obra_presupuesto_renglones.presupuesto_id
      AND public.is_director_of(p.company_id)
  ));

-- Trigger updated_at
CREATE TRIGGER set_updated_at_obra_presupuestos
  BEFORE UPDATE ON public.obra_presupuestos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
