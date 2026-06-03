-- Enums
CREATE TYPE public.vale_gasolina_tipo AS ENUM ('magna', 'premium', 'diesel');
CREATE TYPE public.vale_gasolina_estatus AS ENUM (
  'pendiente_autorizacion', 'autorizado', 'rechazado', 'cancelado', 'entregado', 'confirmado'
);

-- Tabla
CREATE TABLE public.vales_gasolina (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  folio text NOT NULL,
  company_id uuid NOT NULL,
  obra_id uuid,
  tipo_combustible public.vale_gasolina_tipo NOT NULL,
  monto_solicitado numeric NOT NULL CHECK (monto_solicitado > 0),
  descripcion text NOT NULL,
  estatus public.vale_gasolina_estatus NOT NULL DEFAULT 'pendiente_autorizacion',
  solicitado_por uuid NOT NULL,
  solicitado_at timestamptz NOT NULL DEFAULT now(),
  autorizado_por uuid,
  autorizado_at timestamptz,
  monto_autorizado numeric,
  rechazado_por uuid,
  rechazado_at timestamptz,
  motivo_rechazo text,
  cancelado_por uuid,
  cancelado_at timestamptz,
  codigo_vale text,
  ligado_por uuid,
  ligado_at timestamptz,
  confirmado_por uuid,
  confirmado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vales_gasolina_folio_company_unique UNIQUE (company_id, folio)
);

GRANT SELECT, INSERT, UPDATE ON public.vales_gasolina TO authenticated;
GRANT ALL ON public.vales_gasolina TO service_role;

ALTER TABLE public.vales_gasolina ENABLE ROW LEVEL SECURITY;

-- SELECT: cualquier miembro de la empresa
CREATE POLICY "Users see vales in own company"
ON public.vales_gasolina FOR SELECT TO authenticated
USING (company_id = public.current_company_id());

-- INSERT: director, administrativo, supervisor, o miembro de la obra (si hay obra)
CREATE POLICY "Crear vales gasolina"
ON public.vales_gasolina FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.current_company_id()
  AND solicitado_por = auth.uid()
  AND (
    public.is_director_of(company_id)
    OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role)
    OR public.has_role(auth.uid(), company_id, 'supervisor'::public.app_role)
    OR (obra_id IS NOT NULL AND public.is_member_of_obra(obra_id))
  )
);

-- UPDATE: director, supervisor, administrativo, o el solicitante (cancelar/confirmar)
CREATE POLICY "Actualizar vales gasolina"
ON public.vales_gasolina FOR UPDATE TO authenticated
USING (
  company_id = public.current_company_id()
  AND (
    public.is_director_of(company_id)
    OR public.has_role(auth.uid(), company_id, 'supervisor'::public.app_role)
    OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role)
    OR solicitado_por = auth.uid()
  )
)
WITH CHECK (
  company_id = public.current_company_id()
);

-- Índices
CREATE INDEX idx_vales_gasolina_company_estatus ON public.vales_gasolina (company_id, estatus);
CREATE INDEX idx_vales_gasolina_obra_estatus ON public.vales_gasolina (obra_id, estatus);

-- Trigger updated_at
CREATE TRIGGER set_vales_gasolina_updated_at
BEFORE UPDATE ON public.vales_gasolina
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Función para siguiente folio
CREATE OR REPLACE FUNCTION public.siguiente_folio_vale_gasolina(_company_id uuid)
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
    NULLIF(substring(folio FROM '^VG-' || yr::text || '-(\d+)$'), '')::int
  ), 0) + 1
    INTO next_n
    FROM public.vales_gasolina
    WHERE company_id = _company_id
      AND folio LIKE 'VG-' || yr::text || '-%';
  RETURN 'VG-' || yr::text || '-' || lpad(next_n::text, 4, '0');
END;
$$;