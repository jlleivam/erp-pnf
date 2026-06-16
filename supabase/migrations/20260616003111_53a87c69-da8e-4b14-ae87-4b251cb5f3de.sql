
-- 1. Modificar obra_renta_pagos: convertir cada renglón en un "periodo devengado"
ALTER TABLE public.obra_renta_pagos
  ADD COLUMN IF NOT EXISTS cxp_id uuid REFERENCES public.cuentas_por_pagar(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estatus text NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS dias_vencimiento integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento date;

ALTER TABLE public.obra_renta_pagos
  ALTER COLUMN pagado_at DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'obra_renta_pagos_estatus_chk'
  ) THEN
    ALTER TABLE public.obra_renta_pagos
      ADD CONSTRAINT obra_renta_pagos_estatus_chk
      CHECK (estatus IN ('pendiente','pagado','cancelado'));
  END IF;
END $$;

-- Marcar pagos históricos existentes como pagados
UPDATE public.obra_renta_pagos
SET estatus = 'pagado'
WHERE estatus = 'pendiente' AND pagado_at IS NOT NULL;

-- Índice único por periodo (idempotencia del devengo)
CREATE UNIQUE INDEX IF NOT EXISTS obra_renta_pagos_periodo_uniq
  ON public.obra_renta_pagos (renta_id, periodo_inicio, periodo_fin);

CREATE INDEX IF NOT EXISTS obra_renta_pagos_cxp_idx
  ON public.obra_renta_pagos (cxp_id);

-- 2. RPC: generar periodos devengados de una renta
CREATE OR REPLACE FUNCTION public.generar_periodos_renta(_renta_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  paso interval;
  cursor_inicio date;
  cursor_fin date;
  hoy date := current_date;
  limite date;
  dias_periodo integer;
  dias_reales integer;
  monto_periodo numeric;
  proveedor_nombre text;
  nuevo_pago_id uuid;
  nueva_cxp_id uuid;
  folio_cxp text;
  generados integer := 0;
  vencimiento date;
BEGIN
  SELECT * INTO r FROM public.obra_rentas WHERE id = _renta_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF r.estatus NOT IN ('activa','devuelta') THEN RETURN 0; END IF;
  IF r.fecha_llegada_real IS NULL OR r.tarifa_unitaria IS NULL OR r.periodicidad IS NULL THEN RETURN 0; END IF;
  IF r.proveedor_id IS NULL THEN RETURN 0; END IF;

  -- Días por periodo según periodicidad
  dias_periodo := CASE r.periodicidad
    WHEN 'diaria' THEN 1
    WHEN 'semanal' THEN 7
    WHEN 'quincenal' THEN 15
    WHEN 'mensual' THEN 30
    ELSE 30
  END;
  paso := (dias_periodo || ' days')::interval;

  -- Límite hasta donde devengar
  limite := COALESCE(r.fecha_devolucion_real, hoy);

  -- Proveedor para CxP
  SELECT razon_social INTO proveedor_nombre FROM public.terceros WHERE id = r.proveedor_id;
  IF proveedor_nombre IS NULL THEN proveedor_nombre := 'Proveedor'; END IF;

  cursor_inicio := r.fecha_llegada_real;
  WHILE cursor_inicio <= limite LOOP
    cursor_fin := (cursor_inicio + paso - interval '1 day')::date;
    -- Truncar el último periodo si excede el límite
    IF cursor_fin > limite THEN
      cursor_fin := limite;
    END IF;

    dias_reales := (cursor_fin - cursor_inicio + 1);
    monto_periodo := round(
      r.tarifa_unitaria::numeric * COALESCE(r.cantidad,1)::numeric * dias_reales::numeric / dias_periodo::numeric,
      2
    );
    vencimiento := (cursor_fin + (COALESCE(r.dias_aviso_vencimiento,3) || ' days')::interval)::date;

    -- Insertar periodo si no existe
    INSERT INTO public.obra_renta_pagos (
      renta_id, periodo_inicio, periodo_fin, monto,
      pagado_at, referencia, notas, creado_por,
      estatus, dias_vencimiento, fecha_vencimiento
    ) VALUES (
      r.id, cursor_inicio, cursor_fin, monto_periodo,
      NULL, NULL, NULL, COALESCE(r.creado_por, r.cotizado_por),
      'pendiente', 15, vencimiento
    )
    ON CONFLICT (renta_id, periodo_inicio, periodo_fin) DO NOTHING
    RETURNING id INTO nuevo_pago_id;

    IF nuevo_pago_id IS NOT NULL THEN
      -- Crear CxP correspondiente
      folio_cxp := public.siguiente_folio_cxp(r.company_id);
      INSERT INTO public.cuentas_por_pagar (
        company_id, obra_id, folio, fecha_emision, fecha_vencimiento,
        beneficiario_tipo, beneficiario_id, beneficiario_nombre,
        concepto, origen_tipo, origen_id,
        monto_total, monto_pagado, estatus, creado_por
      ) VALUES (
        r.company_id, r.obra_id, folio_cxp, cursor_fin, vencimiento,
        'tercero', r.proveedor_id, proveedor_nombre,
        'Renta ' || COALESCE(r.equipo,'') || ' · ' || to_char(cursor_inicio,'DD/MM/YYYY') || '–' || to_char(cursor_fin,'DD/MM/YYYY'),
        'renta_periodo', nuevo_pago_id,
        monto_periodo, 0, 'pendiente',
        COALESCE(r.creado_por, r.cotizado_por)
      )
      RETURNING id INTO nueva_cxp_id;

      UPDATE public.obra_renta_pagos
        SET cxp_id = nueva_cxp_id
      WHERE id = nuevo_pago_id;

      generados := generados + 1;
      nuevo_pago_id := NULL;
    END IF;

    -- Si ya cubrimos hasta el límite, terminar
    EXIT WHEN cursor_fin >= limite;
    cursor_inicio := (cursor_fin + interval '1 day')::date;
  END LOOP;

  RETURN generados;
END;
$$;

-- 3. RPC: iterar todas las rentas activas
CREATE OR REPLACE FUNCTION public.generar_periodos_rentas_activas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  total integer := 0;
BEGIN
  FOR rec IN
    SELECT id FROM public.obra_rentas WHERE estatus IN ('activa','devuelta')
  LOOP
    total := total + COALESCE(public.generar_periodos_renta(rec.id), 0);
  END LOOP;
  RETURN total;
END;
$$;

-- 4. Permisos de ejecución
GRANT EXECUTE ON FUNCTION public.generar_periodos_renta(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generar_periodos_rentas_activas() TO authenticated, service_role;
