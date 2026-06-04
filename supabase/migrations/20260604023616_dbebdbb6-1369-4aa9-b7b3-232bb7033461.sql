
-- 1. Extender companies con campos de facturación, identidad y config
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS nombre_completo text,
  ADD COLUMN IF NOT EXISTS curp text,
  ADD COLUMN IF NOT EXISTS regimen_fiscal text,
  ADD COLUMN IF NOT EXISTS calle text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS colonia text,
  ADD COLUMN IF NOT EXISTS municipio text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS codigo_postal text,
  ADD COLUMN IF NOT EXISTS registro_imss text,
  ADD COLUMN IF NOT EXISTS registro_infonavit text,
  ADD COLUMN IF NOT EXISTS moneda text NOT NULL DEFAULT 'MXN',
  ADD COLUMN IF NOT EXISTS zona_horaria text NOT NULL DEFAULT 'America/Mexico_City',
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS companies_set_updated_at ON public.companies;
CREATE TRIGGER companies_set_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Tabla unidades_negocio
CREATE TABLE IF NOT EXISTS public.unidades_negocio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS unidades_negocio_company_nombre_unique
  ON public.unidades_negocio (company_id, lower(nombre));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.unidades_negocio TO authenticated;
GRANT ALL ON public.unidades_negocio TO service_role;

ALTER TABLE public.unidades_negocio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members see unidades_negocio of own company" ON public.unidades_negocio;
CREATE POLICY "Members see unidades_negocio of own company"
  ON public.unidades_negocio FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS "Director manages unidades_negocio" ON public.unidades_negocio;
CREATE POLICY "Director manages unidades_negocio"
  ON public.unidades_negocio FOR ALL TO authenticated
  USING (public.is_director_of(company_id))
  WITH CHECK (public.is_director_of(company_id));

DROP TRIGGER IF EXISTS unidades_negocio_set_updated_at ON public.unidades_negocio;
CREATE TRIGGER unidades_negocio_set_updated_at
  BEFORE UPDATE ON public.unidades_negocio
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. obras: agregar unidad_negocio_id, eliminar tipo_obra
ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS unidad_negocio_id uuid REFERENCES public.unidades_negocio(id) ON DELETE RESTRICT;

ALTER TABLE public.obras DROP COLUMN IF EXISTS tipo_obra;
DROP TYPE IF EXISTS public.tipo_obra;

CREATE INDEX IF NOT EXISTS obras_company_unidad_idx
  ON public.obras (company_id, unidad_negocio_id);

-- 4. Bucket de logos de empresa (storage policies)
DROP POLICY IF EXISTS "Members read company logo" ON storage.objects;
CREATE POLICY "Members read company logo"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );

DROP POLICY IF EXISTS "Director uploads company logo" ON storage.objects;
CREATE POLICY "Director uploads company logo"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos'
    AND public.is_director_of(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Director updates company logo" ON storage.objects;
CREATE POLICY "Director updates company logo"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND public.is_director_of(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Director deletes company logo" ON storage.objects;
CREATE POLICY "Director deletes company logo"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND public.is_director_of(((storage.foldername(name))[1])::uuid)
  );
