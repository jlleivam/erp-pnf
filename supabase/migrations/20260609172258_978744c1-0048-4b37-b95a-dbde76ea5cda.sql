
-- 1) Extender enum presupuesto_estatus con nuevos estados de flujo de OC
ALTER TYPE public.presupuesto_estatus ADD VALUE IF NOT EXISTS 'solicitada';
ALTER TYPE public.presupuesto_estatus ADD VALUE IF NOT EXISTS 'rechazada';
