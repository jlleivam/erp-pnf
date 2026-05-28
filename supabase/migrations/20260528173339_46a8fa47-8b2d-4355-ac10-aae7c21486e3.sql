
-- Enums
CREATE TYPE public.tercero_tipo_persona AS ENUM ('moral', 'fisica');
CREATE TYPE public.tercero_categoria AS ENUM ('proveedor', 'contratista', 'ambos');
CREATE TYPE public.tercero_documento_tipo AS ENUM ('constancia_fiscal', 'opinion_sat', 'domicilio_fiscal', 'repse');

-- Tabla principal
CREATE TABLE public.terceros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  tipo_persona public.tercero_tipo_persona NOT NULL,
  razon_social text NOT NULL,
  rfc text NOT NULL,
  curp text,
  regimen_fiscal text,
  direccion_fiscal text,
  telefono text,
  correo text,
  contacto_nombre text,
  contacto_telefono text,
  categoria public.tercero_categoria NOT NULL DEFAULT 'proveedor',
  categoria_productos text,
  credito_disponible numeric,
  dias_credito integer,
  requiere_factura boolean NOT NULL DEFAULT true,
  banco text,
  clabe text,
  beneficiario text,
  retencion_iva boolean NOT NULL DEFAULT false,
  retencion_iva_pct numeric,
  retencion_isr boolean NOT NULL DEFAULT false,
  retencion_isr_pct numeric,
  tipo_trabajos text,
  fondo_garantia boolean NOT NULL DEFAULT false,
  fondo_garantia_pct numeric,
  creado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT terceros_rfc_company_unique UNIQUE (company_id, rfc)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.terceros TO authenticated;
GRANT ALL ON public.terceros TO service_role;

ALTER TABLE public.terceros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see terceros in own company"
  ON public.terceros FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Director o Administrativo gestionan terceros"
  ON public.terceros FOR ALL TO authenticated
  USING (public.is_director_of(company_id) OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role))
  WITH CHECK (public.is_director_of(company_id) OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role));

-- Tabla de documentos
CREATE TABLE public.terceros_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tercero_id uuid NOT NULL REFERENCES public.terceros(id) ON DELETE CASCADE,
  tipo public.tercero_documento_tipo NOT NULL,
  url text NOT NULL,
  fecha_vencimiento date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT terceros_doc_unique UNIQUE (tercero_id, tipo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.terceros_documentos TO authenticated;
GRANT ALL ON public.terceros_documentos TO service_role;

ALTER TABLE public.terceros_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see tercero docs in own company"
  ON public.terceros_documentos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.terceros t
    WHERE t.id = terceros_documentos.tercero_id
      AND t.company_id = public.current_company_id()
  ));

CREATE POLICY "Director o Administrativo gestionan tercero docs"
  ON public.terceros_documentos FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.terceros t
    WHERE t.id = terceros_documentos.tercero_id
      AND (public.is_director_of(t.company_id)
        OR public.has_role(auth.uid(), t.company_id, 'administrativo'::public.app_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.terceros t
    WHERE t.id = terceros_documentos.tercero_id
      AND (public.is_director_of(t.company_id)
        OR public.has_role(auth.uid(), t.company_id, 'administrativo'::public.app_role))
  ));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('terceros-docs', 'terceros-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users read tercero docs in own company"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'terceros-docs'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );

CREATE POLICY "Director o Administrativo manage tercero docs storage"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'terceros-docs'
    AND (
      public.is_director_of(((storage.foldername(name))[1])::uuid)
      OR public.has_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'administrativo'::public.app_role)
    )
  )
  WITH CHECK (
    bucket_id = 'terceros-docs'
    AND (
      public.is_director_of(((storage.foldername(name))[1])::uuid)
      OR public.has_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'administrativo'::public.app_role)
    )
  );
