
-- OC estatus enum
CREATE TYPE public.oc_estatus AS ENUM ('borrador','pendiente_autorizacion','autorizada','rechazada','pagada');

-- Cotizacion paquetes
CREATE TABLE public.cotizacion_paquetes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requisicion_id UUID NOT NULL,
  company_id UUID NOT NULL,
  proveedor_id UUID,
  numero INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requisicion_id, numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotizacion_paquetes TO authenticated;
GRANT ALL ON public.cotizacion_paquetes TO service_role;
ALTER TABLE public.cotizacion_paquetes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see paquetes in own company"
ON public.cotizacion_paquetes FOR SELECT TO authenticated
USING (company_id = current_company_id());

CREATE POLICY "Director o Administrativo gestionan paquetes"
ON public.cotizacion_paquetes FOR ALL TO authenticated
USING (is_director_of(company_id) OR has_role(auth.uid(), company_id, 'administrativo'::app_role))
WITH CHECK (is_director_of(company_id) OR has_role(auth.uid(), company_id, 'administrativo'::app_role));

-- Cotizacion paquete insumos
CREATE TABLE public.cotizacion_paquete_insumos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paquete_id UUID NOT NULL REFERENCES public.cotizacion_paquetes(id) ON DELETE CASCADE,
  insumo_id UUID NOT NULL,
  cantidad NUMERIC NOT NULL,
  precio_unitario NUMERIC NOT NULL DEFAULT 0,
  subtotal NUMERIC GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotizacion_paquete_insumos TO authenticated;
GRANT ALL ON public.cotizacion_paquete_insumos TO service_role;
ALTER TABLE public.cotizacion_paquete_insumos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see paquete insumos in own company"
ON public.cotizacion_paquete_insumos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.cotizacion_paquetes p WHERE p.id = paquete_id AND p.company_id = current_company_id()));

CREATE POLICY "Director o Administrativo gestionan paquete insumos"
ON public.cotizacion_paquete_insumos FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.cotizacion_paquetes p WHERE p.id = paquete_id AND (is_director_of(p.company_id) OR has_role(auth.uid(), p.company_id, 'administrativo'::app_role))))
WITH CHECK (EXISTS (SELECT 1 FROM public.cotizacion_paquetes p WHERE p.id = paquete_id AND (is_director_of(p.company_id) OR has_role(auth.uid(), p.company_id, 'administrativo'::app_role))));

-- Ordenes de compra
CREATE TABLE public.ordenes_compra (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paquete_id UUID NOT NULL REFERENCES public.cotizacion_paquetes(id) ON DELETE RESTRICT,
  requisicion_id UUID NOT NULL,
  company_id UUID NOT NULL,
  obra_id UUID NOT NULL,
  proveedor_id UUID NOT NULL,
  folio TEXT NOT NULL,
  estatus public.oc_estatus NOT NULL DEFAULT 'borrador',
  total NUMERIC NOT NULL DEFAULT 0,
  creado_por UUID NOT NULL,
  enviada_at TIMESTAMPTZ,
  autorizada_at TIMESTAMPTZ,
  autorizada_por UUID,
  rechazada_at TIMESTAMPTZ,
  rechazada_por UUID,
  notas_supervisor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, folio)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordenes_compra TO authenticated;
GRANT ALL ON public.ordenes_compra TO service_role;
ALTER TABLE public.ordenes_compra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see ordenes in own company"
ON public.ordenes_compra FOR SELECT TO authenticated
USING (company_id = current_company_id());

CREATE POLICY "Director o Administrativo gestionan ordenes"
ON public.ordenes_compra FOR ALL TO authenticated
USING (is_director_of(company_id) OR has_role(auth.uid(), company_id, 'administrativo'::app_role))
WITH CHECK (is_director_of(company_id) OR has_role(auth.uid(), company_id, 'administrativo'::app_role));

CREATE POLICY "Supervisor actualiza ordenes asignadas"
ON public.ordenes_compra FOR UPDATE TO authenticated
USING (has_role(auth.uid(), company_id, 'supervisor'::app_role))
WITH CHECK (has_role(auth.uid(), company_id, 'supervisor'::app_role));

-- Folio function
CREATE OR REPLACE FUNCTION public.siguiente_folio_oc(_company_id uuid)
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
    NULLIF(substring(folio FROM '^OC-' || yr::text || '-(\d+)$'), '')::int
  ), 0) + 1
    INTO next_n
    FROM public.ordenes_compra
    WHERE company_id = _company_id
      AND folio LIKE 'OC-' || yr::text || '-%';
  RETURN 'OC-' || yr::text || '-' || lpad(next_n::text, 3, '0');
END;
$function$;
