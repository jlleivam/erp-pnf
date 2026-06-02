
ALTER TABLE public.ordenes_compra RENAME COLUMN enviada_at TO enviada_supervisor_at;

ALTER TABLE public.ordenes_compra
  ADD COLUMN enviada_proveedor_at TIMESTAMPTZ NULL,
  ADD COLUMN enviada_proveedor_por UUID NULL;

CREATE TABLE public.notificaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  obra_id UUID NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  link TEXT NULL,
  requisicion_id UUID NULL,
  oc_id UUID NULL,
  leida_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notificaciones_user_unread ON public.notificaciones (user_id, leida_at) WHERE leida_at IS NULL;
CREATE INDEX idx_notificaciones_user_created ON public.notificaciones (user_id, created_at DESC);

GRANT SELECT, UPDATE ON public.notificaciones TO authenticated;
GRANT ALL ON public.notificaciones TO service_role;

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notificaciones"
ON public.notificaciones FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users mark own notificaciones as read"
ON public.notificaciones FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
