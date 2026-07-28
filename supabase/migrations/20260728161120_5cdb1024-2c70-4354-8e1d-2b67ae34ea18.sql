
ALTER TYPE public.nomina_estatus ADD VALUE IF NOT EXISTS 'pagada';

CREATE TABLE public.nomina_pagos_semana (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  semana_inicio DATE NOT NULL,
  semana_fin DATE NOT NULL,
  fecha_pago DATE NOT NULL,
  total_nomina NUMERIC(14,2) NOT NULL,
  total_cheques NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_vales NUMERIC(14,2) NOT NULL DEFAULT 0,
  notas TEXT,
  creado_por UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nomina_pagos_semana TO authenticated;
GRANT ALL ON public.nomina_pagos_semana TO service_role;
ALTER TABLE public.nomina_pagos_semana ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nps_admin_all" ON public.nomina_pagos_semana FOR ALL TO authenticated
  USING (public.is_director_of(company_id) OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role))
  WITH CHECK (public.is_director_of(company_id) OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role));
CREATE TRIGGER upd_nps BEFORE UPDATE ON public.nomina_pagos_semana FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.nomina_pagos_cheque (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pago_semana_id UUID NOT NULL REFERENCES public.nomina_pagos_semana(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cuenta_id UUID NOT NULL REFERENCES public.cuentas(id),
  folio_cheque TEXT NOT NULL,
  trabajador_id UUID REFERENCES public.trabajadores(id),
  trabajador_nombre TEXT NOT NULL,
  monto NUMERIC(14,2) NOT NULL,
  pago_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nomina_pagos_cheque TO authenticated;
GRANT ALL ON public.nomina_pagos_cheque TO service_role;
ALTER TABLE public.nomina_pagos_cheque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "npc_admin_all" ON public.nomina_pagos_cheque FOR ALL TO authenticated
  USING (public.is_director_of(company_id) OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role))
  WITH CHECK (public.is_director_of(company_id) OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role));

CREATE TABLE public.nomina_pagos_vale (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pago_semana_id UUID NOT NULL REFERENCES public.nomina_pagos_semana(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  obra_id UUID NOT NULL REFERENCES public.obras(id),
  obra_nombre TEXT NOT NULL,
  cuenta_id UUID NOT NULL REFERENCES public.cuentas(id),
  monto NUMERIC(14,2) NOT NULL,
  pago_id UUID,
  nomina_id UUID REFERENCES public.obra_nominas(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nomina_pagos_vale TO authenticated;
GRANT ALL ON public.nomina_pagos_vale TO service_role;
ALTER TABLE public.nomina_pagos_vale ENABLE ROW LEVEL SECURITY;
CREATE POLICY "npv_admin_all" ON public.nomina_pagos_vale FOR ALL TO authenticated
  USING (public.is_director_of(company_id) OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role))
  WITH CHECK (public.is_director_of(company_id) OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role));

CREATE INDEX idx_nps_company_semana ON public.nomina_pagos_semana(company_id, semana_inicio);
CREATE INDEX idx_npc_pago_semana ON public.nomina_pagos_cheque(pago_semana_id);
CREATE INDEX idx_npv_pago_semana ON public.nomina_pagos_vale(pago_semana_id);
