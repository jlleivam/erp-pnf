-- Función utilitaria para timestamps (crear si no existe)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 1. Nuevos estatus de OC
ALTER TYPE public.oc_estatus ADD VALUE IF NOT EXISTS 'recibida_parcial';
ALTER TYPE public.oc_estatus ADD VALUE IF NOT EXISTS 'recibida';

-- 2. Estatus de semana de almacén
DO $$ BEGIN
  CREATE TYPE public.almacen_semana_estatus AS ENUM ('abierta', 'cerrada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Tabla: recepciones
CREATE TABLE public.almacen_recepciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  obra_id UUID NOT NULL,
  oc_id UUID NOT NULL REFERENCES public.ordenes_compra(id) ON DELETE CASCADE,
  folio_remision TEXT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  recibido_por UUID NOT NULL,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_almacen_recepciones_obra ON public.almacen_recepciones(obra_id);
CREATE INDEX idx_almacen_recepciones_oc ON public.almacen_recepciones(oc_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.almacen_recepciones TO authenticated;
GRANT ALL ON public.almacen_recepciones TO service_role;

ALTER TABLE public.almacen_recepciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see recepciones in own company"
ON public.almacen_recepciones FOR SELECT TO authenticated
USING (company_id = public.current_company_id());

CREATE POLICY "Capturan recepciones"
ON public.almacen_recepciones FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.current_company_id()
  AND (
    public.is_director_of(company_id)
    OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role)
    OR public.is_member_of_obra(obra_id)
  )
);

CREATE POLICY "Actualizan recepciones"
ON public.almacen_recepciones FOR UPDATE TO authenticated
USING (
  public.is_director_of(company_id)
  OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role)
  OR public.is_member_of_obra(obra_id)
)
WITH CHECK (
  public.is_director_of(company_id)
  OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role)
  OR public.is_member_of_obra(obra_id)
);

CREATE POLICY "Director elimina recepciones"
ON public.almacen_recepciones FOR DELETE TO authenticated
USING (public.is_director_of(company_id));

-- 4. Tabla: partidas de recepción
CREATE TABLE public.almacen_recepcion_partidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recepcion_id UUID NOT NULL REFERENCES public.almacen_recepciones(id) ON DELETE CASCADE,
  insumo_id UUID NOT NULL,
  cantidad NUMERIC NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_arp_recepcion ON public.almacen_recepcion_partidas(recepcion_id);
CREATE INDEX idx_arp_insumo ON public.almacen_recepcion_partidas(insumo_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.almacen_recepcion_partidas TO authenticated;
GRANT ALL ON public.almacen_recepcion_partidas TO service_role;

ALTER TABLE public.almacen_recepcion_partidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see recepcion partidas in own company"
ON public.almacen_recepcion_partidas FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.almacen_recepciones r
  WHERE r.id = recepcion_id AND r.company_id = public.current_company_id()
));

CREATE POLICY "Gestionan recepcion partidas"
ON public.almacen_recepcion_partidas FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.almacen_recepciones r
  WHERE r.id = recepcion_id
    AND (
      public.is_director_of(r.company_id)
      OR public.has_role(auth.uid(), r.company_id, 'administrativo'::public.app_role)
      OR public.is_member_of_obra(r.obra_id)
    )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.almacen_recepciones r
  WHERE r.id = recepcion_id
    AND (
      public.is_director_of(r.company_id)
      OR public.has_role(auth.uid(), r.company_id, 'administrativo'::public.app_role)
      OR public.is_member_of_obra(r.obra_id)
    )
));

-- 5. Tabla: semanas
CREATE TABLE public.almacen_semanas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  obra_id UUID NOT NULL,
  semana_inicio DATE NOT NULL,
  semana_fin DATE NOT NULL,
  estatus public.almacen_semana_estatus NOT NULL DEFAULT 'abierta',
  cerrada_at TIMESTAMPTZ,
  cerrada_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (obra_id, semana_inicio)
);
CREATE INDEX idx_almacen_semanas_obra ON public.almacen_semanas(obra_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.almacen_semanas TO authenticated;
GRANT ALL ON public.almacen_semanas TO service_role;

ALTER TABLE public.almacen_semanas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see semanas in own company"
ON public.almacen_semanas FOR SELECT TO authenticated
USING (company_id = public.current_company_id());

CREATE POLICY "Gestionan semanas"
ON public.almacen_semanas FOR ALL TO authenticated
USING (
  public.is_director_of(company_id)
  OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role)
  OR public.is_member_of_obra(obra_id)
)
WITH CHECK (
  company_id = public.current_company_id()
  AND (
    public.is_director_of(company_id)
    OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role)
    OR public.is_member_of_obra(obra_id)
  )
);

-- 6. Tabla: movimientos por semana
CREATE TABLE public.almacen_movimientos_semana (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id UUID NOT NULL REFERENCES public.almacen_semanas(id) ON DELETE CASCADE,
  insumo_id UUID NOT NULL,
  inv_inicial NUMERIC NOT NULL DEFAULT 0,
  recibido NUMERIC NOT NULL DEFAULT 0,
  utilizado NUMERIC NOT NULL DEFAULT 0,
  precio_unitario NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (semana_id, insumo_id)
);
CREATE INDEX idx_almacen_mov_semana ON public.almacen_movimientos_semana(semana_id);
CREATE INDEX idx_almacen_mov_insumo ON public.almacen_movimientos_semana(insumo_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.almacen_movimientos_semana TO authenticated;
GRANT ALL ON public.almacen_movimientos_semana TO service_role;

ALTER TABLE public.almacen_movimientos_semana ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see movimientos in own company"
ON public.almacen_movimientos_semana FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.almacen_semanas s
  WHERE s.id = semana_id AND s.company_id = public.current_company_id()
));

CREATE POLICY "Gestionan movimientos"
ON public.almacen_movimientos_semana FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.almacen_semanas s
  WHERE s.id = semana_id
    AND (
      public.is_director_of(s.company_id)
      OR public.has_role(auth.uid(), s.company_id, 'administrativo'::public.app_role)
      OR public.is_member_of_obra(s.obra_id)
    )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.almacen_semanas s
  WHERE s.id = semana_id
    AND (
      public.is_director_of(s.company_id)
      OR public.has_role(auth.uid(), s.company_id, 'administrativo'::public.app_role)
      OR public.is_member_of_obra(s.obra_id)
    )
));

CREATE TRIGGER update_almacen_mov_updated_at
BEFORE UPDATE ON public.almacen_movimientos_semana
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();