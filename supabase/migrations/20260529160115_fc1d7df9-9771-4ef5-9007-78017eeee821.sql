
-- Enum for requisicion status
CREATE TYPE public.requisicion_estatus AS ENUM (
  'borrador','enviada','en_cotizacion','pendiente_autorizacion','oc_generada','completada','rechazada'
);

-- requisiciones table
CREATE TABLE public.requisiciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL,
  company_id uuid NOT NULL,
  folio text NOT NULL,
  creado_por uuid NOT NULL,
  estatus public.requisicion_estatus NOT NULL DEFAULT 'enviada',
  notas text,
  enviada_at timestamptz,
  cotizacion_at timestamptz,
  cotizacion_por uuid,
  autorizacion_at timestamptz,
  autorizacion_por uuid,
  oc_at timestamptz,
  oc_por uuid,
  completada_at timestamptz,
  completada_por uuid,
  rechazada_at timestamptz,
  rechazada_por uuid,
  rechazo_motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT requisiciones_folio_company_unique UNIQUE (company_id, folio)
);

CREATE INDEX idx_requisiciones_obra ON public.requisiciones(obra_id);
CREATE INDEX idx_requisiciones_company ON public.requisiciones(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.requisiciones TO authenticated;
GRANT ALL ON public.requisiciones TO service_role;

ALTER TABLE public.requisiciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see requisiciones in own company"
  ON public.requisiciones FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Members create requisiciones"
  ON public.requisiciones FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND creado_por = auth.uid()
  );

CREATE POLICY "Director o Administrativo gestionan requisiciones"
  ON public.requisiciones FOR UPDATE TO authenticated
  USING (
    public.is_director_of(company_id)
    OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role)
    OR public.has_role(auth.uid(), company_id, 'supervisor'::public.app_role)
  )
  WITH CHECK (
    public.is_director_of(company_id)
    OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role)
    OR public.has_role(auth.uid(), company_id, 'supervisor'::public.app_role)
  );

CREATE POLICY "Creador o Director borra requisicion enviada"
  ON public.requisiciones FOR DELETE TO authenticated
  USING (
    public.is_director_of(company_id)
    OR (creado_por = auth.uid() AND estatus = 'enviada')
  );

-- requisicion_insumos table
CREATE TABLE public.requisicion_insumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisicion_id uuid NOT NULL REFERENCES public.requisiciones(id) ON DELETE CASCADE,
  insumo_id uuid NOT NULL,
  cantidad numeric NOT NULL CHECK (cantidad > 0),
  fecha_requerida date NOT NULL,
  nota text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_requisicion_insumos_req ON public.requisicion_insumos(requisicion_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.requisicion_insumos TO authenticated;
GRANT ALL ON public.requisicion_insumos TO service_role;

ALTER TABLE public.requisicion_insumos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see req insumos in own company"
  ON public.requisicion_insumos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.requisiciones r
    WHERE r.id = requisicion_insumos.requisicion_id
      AND r.company_id = public.current_company_id()
  ));

CREATE POLICY "Members manage req insumos"
  ON public.requisicion_insumos FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.requisiciones r
    WHERE r.id = requisicion_insumos.requisicion_id
      AND r.company_id = public.current_company_id()
      AND (
        public.is_director_of(r.company_id)
        OR r.creado_por = auth.uid()
        OR public.has_role(auth.uid(), r.company_id, 'administrativo'::public.app_role)
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.requisiciones r
    WHERE r.id = requisicion_insumos.requisicion_id
      AND r.company_id = public.current_company_id()
  ));

-- Auto-generate folio function
CREATE OR REPLACE FUNCTION public.siguiente_folio_requisicion(_company_id uuid)
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
    NULLIF(substring(folio FROM '^REQ-' || yr::text || '-(\d+)$'), '')::int
  ), 0) + 1
    INTO next_n
    FROM public.requisiciones
    WHERE company_id = _company_id
      AND folio LIKE 'REQ-' || yr::text || '-%';
  RETURN 'REQ-' || yr::text || '-' || lpad(next_n::text, 3, '0');
END;
$$;
