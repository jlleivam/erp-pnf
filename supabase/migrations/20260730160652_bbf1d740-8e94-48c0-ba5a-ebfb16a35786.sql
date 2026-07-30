CREATE TYPE public.gasto_obra_tipo AS ENUM ('servicio','material');
CREATE TYPE public.gasto_obra_estatus AS ENUM ('borrador','solicitado','autorizado','rechazado','cancelado','pagado');
CREATE TYPE public.gasto_obra_comprobante AS ENUM ('factura','nota','ninguno');

CREATE TABLE public.obra_gastos_directos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  folio text NOT NULL,
  tipo public.gasto_obra_tipo NOT NULL DEFAULT 'servicio',
  proveedor_id uuid REFERENCES public.terceros(id),
  concepto text NOT NULL,
  tipo_comprobante public.gasto_obra_comprobante NOT NULL DEFAULT 'factura',
  comprobante_path text,
  fecha date NOT NULL DEFAULT current_date,
  monto_total numeric(14,2) NOT NULL DEFAULT 0,
  notas text,
  estatus public.gasto_obra_estatus NOT NULL DEFAULT 'borrador',
  motivo_rechazo text,
  solicitado_por uuid,
  solicitado_at timestamptz,
  autorizado_por uuid,
  autorizado_at timestamptz,
  cxp_id uuid REFERENCES public.cuentas_por_pagar(id),
  recepcion_id uuid REFERENCES public.almacen_recepciones(id),
  creado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, folio)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_gastos_directos TO authenticated;
GRANT ALL ON public.obra_gastos_directos TO service_role;
ALTER TABLE public.obra_gastos_directos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver gastos de obra de la empresa"
ON public.obra_gastos_directos FOR SELECT TO authenticated
USING (company_id = public.current_company_id());

CREATE POLICY "Crear gastos de obra"
ON public.obra_gastos_directos FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.current_company_id()
  AND (
    public.is_director_of(company_id)
    OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role)
    OR public.has_role(auth.uid(), company_id, 'supervisor'::public.app_role)
    OR public.is_member_of_obra(obra_id)
  )
);

CREATE POLICY "Actualizar gastos de obra"
ON public.obra_gastos_directos FOR UPDATE TO authenticated
USING (
  company_id = public.current_company_id()
  AND (
    public.is_director_of(company_id)
    OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role)
    OR public.has_role(auth.uid(), company_id, 'supervisor'::public.app_role)
    OR public.is_member_of_obra(obra_id)
  )
)
WITH CHECK (company_id = public.current_company_id());

CREATE POLICY "Director elimina gastos de obra"
ON public.obra_gastos_directos FOR DELETE TO authenticated
USING (public.is_director_of(company_id));

CREATE TABLE public.obra_gasto_directo_partidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gasto_id uuid NOT NULL REFERENCES public.obra_gastos_directos(id) ON DELETE CASCADE,
  insumo_id uuid NOT NULL REFERENCES public.insumos(id),
  cantidad numeric(14,3) NOT NULL,
  precio_unitario numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_gasto_directo_partidas TO authenticated;
GRANT ALL ON public.obra_gasto_directo_partidas TO service_role;
ALTER TABLE public.obra_gasto_directo_partidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver partidas de gastos de obra"
ON public.obra_gasto_directo_partidas FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.obra_gastos_directos g
  WHERE g.id = gasto_id AND g.company_id = public.current_company_id()
));

CREATE POLICY "Gestionar partidas de gastos de obra"
ON public.obra_gasto_directo_partidas FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.obra_gastos_directos g
  WHERE g.id = gasto_id AND g.company_id = public.current_company_id()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.obra_gastos_directos g
  WHERE g.id = gasto_id AND g.company_id = public.current_company_id()
));

CREATE TRIGGER update_obra_gastos_directos_updated_at
BEFORE UPDATE ON public.obra_gastos_directos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.siguiente_folio_gasto_obra(_company_id uuid)
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
    NULLIF(substring(folio FROM '^GD-' || yr::text || '-(\d+)$'), '')::int
  ), 0) + 1
    INTO next_n
    FROM public.obra_gastos_directos
    WHERE company_id = _company_id
      AND folio LIKE 'GD-' || yr::text || '-%';
  RETURN 'GD-' || yr::text || '-' || lpad(next_n::text, 4, '0');
END;
$function$;

CREATE INDEX idx_obra_gastos_directos_obra ON public.obra_gastos_directos(obra_id, estatus);
CREATE INDEX idx_obra_gastos_directos_company ON public.obra_gastos_directos(company_id, estatus);