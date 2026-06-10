
ALTER TABLE public.obra_destajo_anticipos
  ADD COLUMN IF NOT EXISTS pagado_por uuid REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS public.asientos_contables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  asiento_id uuid NOT NULL,
  fecha date NOT NULL,
  concepto text NOT NULL,
  referencia text,
  origen_tipo text NOT NULL,
  origen_id uuid,
  tipo_movimiento text NOT NULL CHECK (tipo_movimiento IN ('cargo','abono')),
  cuenta_contable text NOT NULL,
  monto numeric NOT NULL CHECK (monto >= 0),
  creado_por uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asientos_company ON public.asientos_contables(company_id);
CREATE INDEX IF NOT EXISTS idx_asientos_asiento ON public.asientos_contables(asiento_id);
CREATE INDEX IF NOT EXISTS idx_asientos_origen ON public.asientos_contables(origen_tipo, origen_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asientos_contables TO authenticated;
GRANT ALL ON public.asientos_contables TO service_role;

ALTER TABLE public.asientos_contables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver asientos de su empresa"
ON public.asientos_contables FOR SELECT
TO authenticated
USING (company_id = public.current_company_id());

CREATE POLICY "Director o administrativo gestiona asientos"
ON public.asientos_contables FOR ALL
TO authenticated
USING (
  company_id = public.current_company_id()
  AND (
    public.is_director_of(company_id)
    OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role)
  )
)
WITH CHECK (
  company_id = public.current_company_id()
  AND (
    public.is_director_of(company_id)
    OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role)
  )
);

CREATE TRIGGER update_asientos_contables_updated_at
BEFORE UPDATE ON public.asientos_contables
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
