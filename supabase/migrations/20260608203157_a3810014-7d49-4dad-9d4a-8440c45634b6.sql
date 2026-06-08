
-- Tabla cuentas
CREATE TABLE public.cuentas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('bancaria','caja_fuerte')),
  moneda TEXT NOT NULL DEFAULT 'MXN',
  banco TEXT,
  numero_cuenta TEXT,
  clabe TEXT,
  saldo_inicial NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_actual NUMERIC(14,2) NOT NULL DEFAULT 0,
  activa BOOLEAN NOT NULL DEFAULT true,
  notas TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cuentas_company ON public.cuentas(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cuentas TO authenticated;
GRANT ALL ON public.cuentas TO service_role;

ALTER TABLE public.cuentas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cuentas_select_director_admin" ON public.cuentas
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      public.has_role(auth.uid(), company_id, 'director'::public.app_role)
      OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role)
    )
  );

CREATE POLICY "cuentas_insert_director" ON public.cuentas
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_role(auth.uid(), company_id, 'director'::public.app_role)
  );

CREATE POLICY "cuentas_update_director" ON public.cuentas
  FOR UPDATE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_role(auth.uid(), company_id, 'director'::public.app_role)
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.has_role(auth.uid(), company_id, 'director'::public.app_role)
  );

CREATE POLICY "cuentas_delete_director" ON public.cuentas
  FOR DELETE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND public.has_role(auth.uid(), company_id, 'director'::public.app_role)
  );

CREATE TRIGGER update_cuentas_updated_at
  BEFORE UPDATE ON public.cuentas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabla cuenta_movimientos
CREATE TABLE public.cuenta_movimientos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cuenta_id UUID NOT NULL REFERENCES public.cuentas(id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso','egreso')),
  monto NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  concepto TEXT,
  referencia TEXT,
  origen TEXT NOT NULL CHECK (origen IN ('apertura','ajuste','pago','traspaso','ingreso_manual')),
  origen_id UUID,
  creado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cuenta_movs_cuenta_fecha ON public.cuenta_movimientos(cuenta_id, fecha DESC);
CREATE INDEX idx_cuenta_movs_company ON public.cuenta_movimientos(company_id);

GRANT SELECT ON public.cuenta_movimientos TO authenticated;
GRANT ALL ON public.cuenta_movimientos TO service_role;

ALTER TABLE public.cuenta_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cuenta_movs_select_director_admin" ON public.cuenta_movimientos
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      public.has_role(auth.uid(), company_id, 'director'::public.app_role)
      OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role)
    )
  );
