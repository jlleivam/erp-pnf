
-- Create unit catalog table
CREATE TABLE public.insumo_unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  codigo text NOT NULL,
  nombre text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX insumo_unidades_company_codigo_idx
  ON public.insumo_unidades (company_id, upper(codigo));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insumo_unidades TO authenticated;
GRANT ALL ON public.insumo_unidades TO service_role;

ALTER TABLE public.insumo_unidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see unidades in own company"
  ON public.insumo_unidades FOR SELECT TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "Director manages unidades"
  ON public.insumo_unidades FOR ALL TO authenticated
  USING (is_director_of(company_id))
  WITH CHECK (is_director_of(company_id));

-- Convert insumos.unidad from enum to text
ALTER TABLE public.insumos ALTER COLUMN unidad TYPE text USING unidad::text;

-- Seed default units per existing company
INSERT INTO public.insumo_unidades (company_id, codigo, nombre)
SELECT c.id, u.codigo, u.nombre
FROM public.companies c
CROSS JOIN (VALUES
  ('KG','Kilogramo'),
  ('M2','Metro cuadrado'),
  ('M3','Metro cúbico'),
  ('ML','Metro lineal'),
  ('PZA','Pieza'),
  ('LT','Litro'),
  ('TON','Tonelada'),
  ('BTO','Bulto')
) AS u(codigo, nombre)
ON CONFLICT DO NOTHING;

-- Drop the now-unused enum type
DROP TYPE IF EXISTS public.insumo_unidad;
