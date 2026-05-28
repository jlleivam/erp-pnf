
-- Enums
CREATE TYPE public.trabajador_sexo AS ENUM ('masculino','femenino');
CREATE TYPE public.trabajador_tipo_contrato AS ENUM ('eventual_urbano','eventual_campo','permanente');
CREATE TYPE public.trabajador_imss_estatus AS ENUM ('alta_activa','sin_alta','en_tramite','baja');
CREATE TYPE public.trabajador_autorizacion AS ENUM ('autorizado','pendiente');
CREATE TYPE public.trabajador_doc_tipo AS ENUM ('ine','curp','domicilio','contrato');

-- Tabla principal
CREATE TABLE public.trabajadores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  nombre_completo text NOT NULL,
  telefono text,
  correo text,
  direccion text,
  curp text,
  nss text,
  rfc text,
  fecha_nacimiento date,
  sexo public.trabajador_sexo,
  estado_civil text,
  puesto text,
  sueldo_diario numeric,
  tipo_contrato public.trabajador_tipo_contrato,
  fecha_ingreso date,
  fecha_baja date,
  imss_estatus public.trabajador_imss_estatus NOT NULL DEFAULT 'sin_alta',
  imss_fecha_alta date,
  imss_nss text,
  imss_sbc numeric,
  imss_tipo_trabajador text,
  estatus_autorizacion public.trabajador_autorizacion NOT NULL DEFAULT 'pendiente',
  creado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX trabajadores_curp_company_uq
  ON public.trabajadores (company_id, curp) WHERE curp IS NOT NULL;
CREATE INDEX trabajadores_company_idx ON public.trabajadores (company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trabajadores TO authenticated;
GRANT ALL ON public.trabajadores TO service_role;

ALTER TABLE public.trabajadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see trabajadores in own company"
  ON public.trabajadores FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Director o Administrativo gestionan trabajadores"
  ON public.trabajadores FOR ALL TO authenticated
  USING (public.is_director_of(company_id) OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role))
  WITH CHECK (public.is_director_of(company_id) OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role));

CREATE POLICY "PM o Auxiliar pueden solicitar alta"
  ON public.trabajadores FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND estatus_autorizacion = 'pendiente'
    AND creado_por = auth.uid()
  );

-- Documentos
CREATE TABLE public.trabajadores_documentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trabajador_id uuid NOT NULL REFERENCES public.trabajadores(id) ON DELETE CASCADE,
  tipo public.trabajador_doc_tipo NOT NULL,
  url text NOT NULL,
  fecha_vencimiento date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trabajador_id, tipo)
);

CREATE INDEX trabajadores_documentos_trabajador_idx
  ON public.trabajadores_documentos (trabajador_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trabajadores_documentos TO authenticated;
GRANT ALL ON public.trabajadores_documentos TO service_role;

ALTER TABLE public.trabajadores_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see trabajador docs in own company"
  ON public.trabajadores_documentos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trabajadores t
    WHERE t.id = trabajadores_documentos.trabajador_id
      AND t.company_id = public.current_company_id()
  ));

CREATE POLICY "Director o Administrativo gestionan trabajador docs"
  ON public.trabajadores_documentos FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trabajadores t
    WHERE t.id = trabajadores_documentos.trabajador_id
      AND (public.is_director_of(t.company_id) OR public.has_role(auth.uid(), t.company_id, 'administrativo'::public.app_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.trabajadores t
    WHERE t.id = trabajadores_documentos.trabajador_id
      AND (public.is_director_of(t.company_id) OR public.has_role(auth.uid(), t.company_id, 'administrativo'::public.app_role))
  ));

-- Bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('trabajadores-docs', 'trabajadores-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users see trabajador files in own company"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'trabajadores-docs'
    AND (storage.foldername(name))[1] = public.current_company_id()::text
  );

CREATE POLICY "Director o Administrativo manejan trabajador files"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'trabajadores-docs'
    AND (
      public.is_director_of(((storage.foldername(name))[1])::uuid)
      OR public.has_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'administrativo'::public.app_role)
    )
  )
  WITH CHECK (
    bucket_id = 'trabajadores-docs'
    AND (
      public.is_director_of(((storage.foldername(name))[1])::uuid)
      OR public.has_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'administrativo'::public.app_role)
    )
  );
