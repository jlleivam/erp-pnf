
CREATE OR REPLACE FUNCTION public.recompute_requisicion_estatus(_req_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req record;
  total_oc int;
  faltantes int;
  actor uuid;
BEGIN
  IF _req_id IS NULL THEN RETURN; END IF;

  SELECT id, estatus, autorizacion_por, creado_por INTO req
    FROM public.requisiciones WHERE id = _req_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF req.estatus IN ('completada','rechazada','borrador') THEN RETURN; END IF;

  SELECT COUNT(*) INTO total_oc
    FROM public.ordenes_compra
   WHERE requisicion_id = _req_id AND estatus <> 'rechazada';

  IF total_oc = 0 THEN RETURN; END IF;

  SELECT COUNT(*) INTO faltantes
    FROM public.ordenes_compra
   WHERE requisicion_id = _req_id
     AND estatus <> 'rechazada'
     AND (estatus NOT IN ('recibida','pagada') OR COALESCE(estado_pago,'pendiente') <> 'pagada');

  IF faltantes = 0 THEN
    BEGIN
      actor := NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    EXCEPTION WHEN others THEN
      actor := NULL;
    END;
    UPDATE public.requisiciones
       SET estatus = 'completada',
           completada_at = now(),
           completada_por = COALESCE(actor, req.autorizacion_por, req.creado_por)
     WHERE id = _req_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_oc_recompute_requisicion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_requisicion_estatus(OLD.requisicion_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_requisicion_estatus(NEW.requisicion_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS oc_recompute_requisicion ON public.ordenes_compra;
CREATE TRIGGER oc_recompute_requisicion
AFTER INSERT OR UPDATE OF estatus, estado_pago, monto_pagado, requisicion_id OR DELETE
ON public.ordenes_compra
FOR EACH ROW EXECUTE FUNCTION public.trg_oc_recompute_requisicion();

-- Backfill
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id FROM public.requisiciones WHERE estatus NOT IN ('completada','rechazada','borrador')
  LOOP
    PERFORM public.recompute_requisicion_estatus(r.id);
  END LOOP;
END $$;
