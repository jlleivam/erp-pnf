-- 1) obra_destajos: campos contractuales
ALTER TABLE public.obra_destajos
  ADD COLUMN IF NOT EXISTS anticipo_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS anticipo_monto numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fondo_garantia_pct numeric NOT NULL DEFAULT 0;

ALTER TABLE public.obra_destajos
  ADD CONSTRAINT obra_destajos_anticipo_pct_range CHECK (anticipo_pct >= 0 AND anticipo_pct <= 100),
  ADD CONSTRAINT obra_destajos_fondo_pct_range CHECK (fondo_garantia_pct >= 0 AND fondo_garantia_pct <= 100);

-- 2) obra_destajo_estimaciones: amortización + retención + liberación + neto
-- monto_total se mantiene como el BRUTO de la semana (compatibilidad con código existente).
ALTER TABLE public.obra_destajo_estimaciones
  ADD COLUMN IF NOT EXISTS amortizacion_anticipo numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retencion_fondo numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS liberacion_fondo numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monto_neto numeric NOT NULL DEFAULT 0;

-- 3) Tabla para el pago del anticipo al destajista
CREATE TABLE IF NOT EXISTS public.obra_destajo_anticipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destajo_id uuid NOT NULL REFERENCES public.obra_destajos(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  monto numeric NOT NULL DEFAULT 0,
  metodo_pago text,
  referencia text,
  pagado boolean NOT NULL DEFAULT false,
  pagado_at timestamptz,
  creado_por uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT obra_destajo_anticipos_unique_destajo UNIQUE (destajo_id)
);

CREATE INDEX IF NOT EXISTS idx_destajo_anticipos_destajo ON public.obra_destajo_anticipos(destajo_id);
CREATE INDEX IF NOT EXISTS idx_destajo_anticipos_company ON public.obra_destajo_anticipos(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_destajo_anticipos TO authenticated;
GRANT ALL ON public.obra_destajo_anticipos TO service_role;

ALTER TABLE public.obra_destajo_anticipos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see destajo anticipos in own company"
  ON public.obra_destajo_anticipos
  FOR SELECT
  TO authenticated
  USING (company_id = current_company_id());

CREATE POLICY "Gestion destajo anticipos"
  ON public.obra_destajo_anticipos
  FOR ALL
  TO authenticated
  USING (
    company_id = current_company_id() AND EXISTS (
      SELECT 1 FROM public.obra_destajos d
      WHERE d.id = obra_destajo_anticipos.destajo_id
        AND (is_director_of(d.company_id) OR is_member_of_obra(d.obra_id))
    )
  )
  WITH CHECK (
    company_id = current_company_id() AND EXISTS (
      SELECT 1 FROM public.obra_destajos d
      WHERE d.id = obra_destajo_anticipos.destajo_id
        AND (is_director_of(d.company_id) OR is_member_of_obra(d.obra_id))
    )
  );

CREATE TRIGGER update_obra_destajo_anticipos_updated_at
  BEFORE UPDATE ON public.obra_destajo_anticipos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
