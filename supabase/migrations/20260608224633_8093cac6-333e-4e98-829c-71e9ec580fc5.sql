-- Tabla pagos (polimórfica para futuras fases)
CREATE TABLE public.pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cuenta_id uuid NOT NULL REFERENCES public.cuentas(id) ON DELETE RESTRICT,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  monto numeric(14,2) NOT NULL CHECK (monto > 0),
  metodo text NOT NULL CHECK (metodo IN ('efectivo','transferencia','cheque')),
  referencia text,
  concepto text,
  notas text,
  origen_tipo text NOT NULL CHECK (origen_tipo IN ('oc','nomina','subcontrato','renta','destajo','gasolina','caja_chica')),
  origen_id uuid NOT NULL,
  cuenta_movimiento_id uuid REFERENCES public.cuenta_movimientos(id) ON DELETE SET NULL,
  creado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelado_at timestamptz,
  cancelado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pagos_origen_idx ON public.pagos(origen_tipo, origen_id);
CREATE INDEX pagos_cuenta_fecha_idx ON public.pagos(cuenta_id, fecha DESC);
CREATE INDEX pagos_company_fecha_idx ON public.pagos(company_id, fecha DESC);

GRANT SELECT ON public.pagos TO authenticated;
GRANT ALL ON public.pagos TO service_role;

ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Director y admin ven pagos de su company"
  ON public.pagos FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (
      public.is_director_of(company_id)
      OR public.has_role(auth.uid(), company_id, 'administrativo'::public.app_role)
    )
  );

-- Columnas en ordenes_compra para tracking de pagos
ALTER TABLE public.ordenes_compra
  ADD COLUMN monto_pagado numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN estado_pago text NOT NULL DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente','parcial','pagado')),
  ADD COLUMN pagada_at timestamptz;