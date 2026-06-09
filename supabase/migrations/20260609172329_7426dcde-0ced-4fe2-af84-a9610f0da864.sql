
-- Columnas para registrar solicitud/rechazo en obra_presupuestos
ALTER TABLE public.obra_presupuestos
  ADD COLUMN IF NOT EXISTS enviado_at timestamptz,
  ADD COLUMN IF NOT EXISTS enviado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rechazado_at timestamptz,
  ADD COLUMN IF NOT EXISTS rechazado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rechazo_motivo text;

-- Helpers para validar rol dentro del equipo de la obra
CREATE OR REPLACE FUNCTION public.is_residente_de_obra(_obra_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.obra_team
    WHERE obra_id = _obra_id
      AND user_id = auth.uid()
      AND role = 'residente'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_supervisor_de_obra(_obra_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.obra_team
    WHERE obra_id = _obra_id
      AND user_id = auth.uid()
      AND role = 'supervisor'
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_residente_de_obra(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_supervisor_de_obra(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_residente_de_obra(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_supervisor_de_obra(uuid) TO authenticated, service_role;
