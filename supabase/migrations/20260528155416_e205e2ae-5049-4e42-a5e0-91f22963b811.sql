
-- Enums
CREATE TYPE public.insumo_unidad AS ENUM ('KG','M2','M3','ML','PZA','LT','TON');
CREATE TYPE public.insumo_estatus AS ENUM ('autorizado','pendiente');

-- Categorias
CREATE TABLE public.insumo_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  nombre text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, nombre)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insumo_categorias TO authenticated;
GRANT ALL ON public.insumo_categorias TO service_role;
ALTER TABLE public.insumo_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see categorias in own company"
  ON public.insumo_categorias FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Director manages categorias"
  ON public.insumo_categorias FOR ALL TO authenticated
  USING (public.is_director_of(company_id))
  WITH CHECK (public.is_director_of(company_id));

-- Insumos
CREATE TABLE public.insumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  categoria_id uuid REFERENCES public.insumo_categorias(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  unidad public.insumo_unidad NOT NULL,
  estatus public.insumo_estatus NOT NULL DEFAULT 'pendiente',
  solicitado_por uuid,
  autorizado_por uuid,
  autorizado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_insumos_company ON public.insumos(company_id);
CREATE INDEX idx_insumos_categoria ON public.insumos(categoria_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insumos TO authenticated;
GRANT ALL ON public.insumos TO service_role;
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see insumos in own company"
  ON public.insumos FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Users can request insumos in own company"
  ON public.insumos FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND estatus = 'pendiente'
    AND solicitado_por = auth.uid()
  );

CREATE POLICY "Director updates insumos"
  ON public.insumos FOR UPDATE TO authenticated
  USING (public.is_director_of(company_id))
  WITH CHECK (public.is_director_of(company_id));

CREATE POLICY "Director deletes insumos"
  ON public.insumos FOR DELETE TO authenticated
  USING (public.is_director_of(company_id));

-- Historial de precios
CREATE TABLE public.insumos_historial_precios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insumo_id uuid NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  precio_unitario numeric(14,4) NOT NULL,
  proveedor text,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  obra_id uuid,
  cantidad numeric(14,4),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hp_insumo_fecha ON public.insumos_historial_precios(insumo_id, fecha DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insumos_historial_precios TO authenticated;
GRANT ALL ON public.insumos_historial_precios TO service_role;
ALTER TABLE public.insumos_historial_precios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see historial in own company"
  ON public.insumos_historial_precios FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.insumos i
    WHERE i.id = insumos_historial_precios.insumo_id
      AND i.company_id = public.current_company_id()
  ));

CREATE POLICY "Director manages historial"
  ON public.insumos_historial_precios FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.insumos i
    WHERE i.id = insumos_historial_precios.insumo_id
      AND public.is_director_of(i.company_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.insumos i
    WHERE i.id = insumos_historial_precios.insumo_id
      AND public.is_director_of(i.company_id)
  ));
