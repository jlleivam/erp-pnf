
-- 1. Extender enum estatus
ALTER TYPE public.almacen_semana_estatus ADD VALUE IF NOT EXISTS 'bloqueada';

-- 2. Tabla de solicitudes de desbloqueo
CREATE TABLE IF NOT EXISTS public.almacen_semana_desbloqueo_solicitudes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  semana_id UUID NOT NULL REFERENCES public.almacen_semanas(id) ON DELETE CASCADE,
  solicitado_por UUID NOT NULL REFERENCES auth.users(id),
  motivo TEXT NOT NULL,
  estatus TEXT NOT NULL DEFAULT 'pendiente' CHECK (estatus IN ('pendiente','aprobada','rechazada')),
  respuesta TEXT,
  resuelto_por UUID REFERENCES auth.users(id),
  resuelto_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_almacen_desbloqueo_semana ON public.almacen_semana_desbloqueo_solicitudes(semana_id);
CREATE INDEX IF NOT EXISTS idx_almacen_desbloqueo_obra_estatus ON public.almacen_semana_desbloqueo_solicitudes(obra_id, estatus);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.almacen_semana_desbloqueo_solicitudes TO authenticated;
GRANT ALL ON public.almacen_semana_desbloqueo_solicitudes TO service_role;

ALTER TABLE public.almacen_semana_desbloqueo_solicitudes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver solicitudes de obra"
  ON public.almacen_semana_desbloqueo_solicitudes
  FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (public.is_director_of(company_id) OR public.is_member_of_obra(obra_id))
  );

CREATE POLICY "Crear solicitudes residente/supervisor"
  ON public.almacen_semana_desbloqueo_solicitudes
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND solicitado_por = auth.uid()
    AND (public.is_residente_de_obra(obra_id) OR public.is_supervisor_de_obra(obra_id))
  );

CREATE POLICY "Resolver supervisor/director"
  ON public.almacen_semana_desbloqueo_solicitudes
  FOR UPDATE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND (public.is_director_of(company_id) OR public.is_supervisor_de_obra(obra_id))
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND (public.is_director_of(company_id) OR public.is_supervisor_de_obra(obra_id))
  );

CREATE TRIGGER almacen_desbloqueo_updated_at
  BEFORE UPDATE ON public.almacen_semana_desbloqueo_solicitudes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Cron job: cada lunes 00:05 cierra semanas vencidas
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'almacen-cerrar-semanas-vencidas',
  '5 0 * * 1',
  $$
  UPDATE public.almacen_semanas
     SET estatus = 'cerrada',
         cerrada_at = COALESCE(cerrada_at, now())
   WHERE estatus IN ('abierta','bloqueada')
     AND semana_fin < CURRENT_DATE;
  $$
);
