
-- 1. Extend clientes table
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS regimen_fiscal text,
  ADD COLUMN IF NOT EXISTS direccion_fiscal text,
  ADD COLUMN IF NOT EXISTS telefono text,
  ADD COLUMN IF NOT EXISTS correo text,
  ADD COLUMN IF NOT EXISTS contacto_nombre text,
  ADD COLUMN IF NOT EXISTS contacto_telefono text,
  ADD COLUMN IF NOT EXISTS curp text,
  ADD COLUMN IF NOT EXISTS condiciones_pago integer,
  ADD COLUMN IF NOT EXISTS limite_credito numeric,
  ADD COLUMN IF NOT EXISTS banco text,
  ADD COLUMN IF NOT EXISTS clabe text,
  ADD COLUMN IF NOT EXISTS beneficiario text,
  ADD COLUMN IF NOT EXISTS constancia_fiscal_url text,
  ADD COLUMN IF NOT EXISTS constancia_fiscal_vencimiento date,
  ADD COLUMN IF NOT EXISTS opinion_sat_url text,
  ADD COLUMN IF NOT EXISTS opinion_sat_vencimiento date;

-- 2. Add monto_contratado to obras
ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS monto_contratado numeric;

-- 3. Update clientes RLS: allow Administrativo to manage too
DROP POLICY IF EXISTS "Director manages clientes" ON public.clientes;
CREATE POLICY "Director o Administrativo gestionan clientes"
ON public.clientes
FOR ALL
TO authenticated
USING (
  public.is_director_of(company_id)
  OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role)
)
WITH CHECK (
  public.is_director_of(company_id)
  OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role)
);

-- 4. Storage bucket for cliente documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('clientes-docs', 'clientes-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: path layout is <company_id>/<cliente_id>/<file>
DROP POLICY IF EXISTS "clientes-docs select" ON storage.objects;
CREATE POLICY "clientes-docs select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'clientes-docs'
  AND (storage.foldername(name))[1] = public.current_company_id()::text
);

DROP POLICY IF EXISTS "clientes-docs insert" ON storage.objects;
CREATE POLICY "clientes-docs insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'clientes-docs'
  AND (storage.foldername(name))[1] = public.current_company_id()::text
  AND (
    public.is_director_of(public.current_company_id())
    OR public.has_role(auth.uid(), public.current_company_id(), 'administrativo'::public.app_role)
  )
);

DROP POLICY IF EXISTS "clientes-docs update" ON storage.objects;
CREATE POLICY "clientes-docs update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'clientes-docs'
  AND (storage.foldername(name))[1] = public.current_company_id()::text
  AND (
    public.is_director_of(public.current_company_id())
    OR public.has_role(auth.uid(), public.current_company_id(), 'administrativo'::public.app_role)
  )
);

DROP POLICY IF EXISTS "clientes-docs delete" ON storage.objects;
CREATE POLICY "clientes-docs delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'clientes-docs'
  AND (storage.foldername(name))[1] = public.current_company_id()::text
  AND (
    public.is_director_of(public.current_company_id())
    OR public.has_role(auth.uid(), public.current_company_id(), 'administrativo'::public.app_role)
  )
);
