
-- Terceros: add authorization workflow columns
ALTER TABLE public.terceros
  ADD COLUMN IF NOT EXISTS estatus_autorizacion text NOT NULL DEFAULT 'autorizado'
    CHECK (estatus_autorizacion IN ('autorizado','pendiente')),
  ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_terceros_pendientes
  ON public.terceros(company_id)
  WHERE estatus_autorizacion = 'pendiente';

-- Clientes: same
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS estatus_autorizacion text NOT NULL DEFAULT 'autorizado'
    CHECK (estatus_autorizacion IN ('autorizado','pendiente')),
  ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_pendientes
  ON public.clientes(company_id)
  WHERE estatus_autorizacion = 'pendiente';

-- Allow any authenticated member of the company to INSERT (solicitud de alta).
-- UPDATE/DELETE remain restricted through the existing "gestionan" ALL policies.
DROP POLICY IF EXISTS "Miembros de la empresa pueden solicitar terceros" ON public.terceros;
CREATE POLICY "Miembros de la empresa pueden solicitar terceros"
  ON public.terceros
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS "Miembros de la empresa pueden solicitar clientes" ON public.clientes;
CREATE POLICY "Miembros de la empresa pueden solicitar clientes"
  ON public.clientes
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.current_company_id());
