
-- Enum de estatus de solicitud de cotización
CREATE TYPE public.sc_estatus AS ENUM ('borrador', 'enviada', 'recibida', 'descartada');

-- Tabla principal de solicitudes de cotización
CREATE TABLE public.cotizacion_solicitudes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requisicion_id uuid NOT NULL,
  company_id uuid NOT NULL,
  proveedor_id uuid NOT NULL,
  folio text NOT NULL,
  estatus public.sc_estatus NOT NULL DEFAULT 'borrador',
  notas text,
  creado_por uuid NOT NULL,
  enviada_at timestamptz,
  recibida_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, folio)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotizacion_solicitudes TO authenticated;
GRANT ALL ON public.cotizacion_solicitudes TO service_role;

ALTER TABLE public.cotizacion_solicitudes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see SCs in own company"
  ON public.cotizacion_solicitudes FOR SELECT
  TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Director o Administrativo gestionan SCs"
  ON public.cotizacion_solicitudes FOR ALL
  TO authenticated
  USING (public.is_director_of(company_id) OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role))
  WITH CHECK (public.is_director_of(company_id) OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role));

-- Insumos por solicitud
CREATE TABLE public.cotizacion_solicitud_insumos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  solicitud_id uuid NOT NULL REFERENCES public.cotizacion_solicitudes(id) ON DELETE CASCADE,
  insumo_id uuid NOT NULL,
  cantidad numeric NOT NULL,
  precio_unitario numeric,
  disponible boolean NOT NULL DEFAULT true,
  nota text,
  subtotal numeric GENERATED ALWAYS AS (cantidad * COALESCE(precio_unitario, 0)) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (solicitud_id, insumo_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotizacion_solicitud_insumos TO authenticated;
GRANT ALL ON public.cotizacion_solicitud_insumos TO service_role;

ALTER TABLE public.cotizacion_solicitud_insumos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see SC insumos in own company"
  ON public.cotizacion_solicitud_insumos FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cotizacion_solicitudes s
    WHERE s.id = cotizacion_solicitud_insumos.solicitud_id
      AND s.company_id = public.current_company_id()
  ));

CREATE POLICY "Director o Administrativo gestionan SC insumos"
  ON public.cotizacion_solicitud_insumos FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cotizacion_solicitudes s
    WHERE s.id = cotizacion_solicitud_insumos.solicitud_id
      AND (public.is_director_of(s.company_id) OR public.has_role(auth.uid(), s.company_id, 'administrativo'::public.app_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.cotizacion_solicitudes s
    WHERE s.id = cotizacion_solicitud_insumos.solicitud_id
      AND (public.is_director_of(s.company_id) OR public.has_role(auth.uid(), s.company_id, 'administrativo'::public.app_role))
  ));

CREATE INDEX idx_sc_requisicion ON public.cotizacion_solicitudes (requisicion_id);
CREATE INDEX idx_sc_insumos_solicitud ON public.cotizacion_solicitud_insumos (solicitud_id);

-- Folio automático SC-YYYY-NNN por empresa
CREATE OR REPLACE FUNCTION public.siguiente_folio_sc(_company_id uuid)
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
    NULLIF(substring(folio FROM '^SC-' || yr::text || '-(\d+)$'), '')::int
  ), 0) + 1
    INTO next_n
    FROM public.cotizacion_solicitudes
    WHERE company_id = _company_id
      AND folio LIKE 'SC-' || yr::text || '-%';
  RETURN 'SC-' || yr::text || '-' || lpad(next_n::text, 3, '0');
END;
$$;
