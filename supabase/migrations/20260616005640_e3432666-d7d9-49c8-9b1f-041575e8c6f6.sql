
CREATE OR REPLACE FUNCTION public.devengar_asientos_renta(_renta_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  r record;
  dias_periodo integer;
  monto_diario numeric;
  ultimo_dia date;
  cursor_dia date;
  limite date;
  hoy date := current_date;
  nuevo_asiento_id uuid;
  generados integer := 0;
  concepto_txt text;
  ref_txt text;
  creador uuid;
BEGIN
  SELECT * INTO r FROM public.obra_rentas WHERE id = _renta_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF r.estatus NOT IN ('activa','devuelta') THEN RETURN 0; END IF;
  IF r.fecha_llegada_real IS NULL OR r.tarifa_unitaria IS NULL OR r.periodicidad IS NULL THEN RETURN 0; END IF;
  IF r.proveedor_id IS NULL THEN RETURN 0; END IF;

  dias_periodo := CASE r.periodicidad
    WHEN 'diaria' THEN 1
    WHEN 'semanal' THEN 7
    WHEN 'quincenal' THEN 15
    WHEN 'mensual' THEN 30
    ELSE 30
  END;

  monto_diario := round(
    (r.tarifa_unitaria::numeric * COALESCE(r.cantidad,1)::numeric) / dias_periodo::numeric,
    2
  );

  IF monto_diario <= 0 THEN RETURN 0; END IF;

  limite := LEAST(hoy, COALESCE(r.fecha_devolucion_real, hoy));

  -- Último día ya devengado contablemente
  SELECT MAX(fecha) INTO ultimo_dia
    FROM public.asientos_contables
   WHERE origen_tipo = 'renta_devengo_diario'
     AND origen_id = r.id;

  IF ultimo_dia IS NULL THEN
    cursor_dia := r.fecha_llegada_real;
  ELSE
    cursor_dia := (ultimo_dia + 1)::date;
    IF cursor_dia < r.fecha_llegada_real THEN
      cursor_dia := r.fecha_llegada_real;
    END IF;
  END IF;

  creador := COALESCE(r.creado_por, r.cotizado_por);
  IF creador IS NULL THEN RETURN 0; END IF;

  ref_txt := substring(r.id::text, 1, 8);

  WHILE cursor_dia <= limite LOOP
    -- Salvaguarda extra: solo insertar si no existe ya un asiento del día
    IF NOT EXISTS (
      SELECT 1 FROM public.asientos_contables
       WHERE origen_tipo = 'renta_devengo_diario'
         AND origen_id = r.id
         AND fecha = cursor_dia
    ) THEN
      nuevo_asiento_id := gen_random_uuid();
      concepto_txt := 'Renta ' || COALESCE(r.equipo,'') || ' · ' || to_char(cursor_dia,'DD/MM/YYYY');

      INSERT INTO public.asientos_contables (
        company_id, asiento_id, fecha, concepto, referencia,
        origen_tipo, origen_id, tipo_movimiento, cuenta_contable, monto, creado_por
      ) VALUES
        (r.company_id, nuevo_asiento_id, cursor_dia, concepto_txt, ref_txt,
         'renta_devengo_diario', r.id, 'cargo', 'Costo de obra - Rentas', monto_diario, creador),
        (r.company_id, nuevo_asiento_id, cursor_dia, concepto_txt, ref_txt,
         'renta_devengo_diario', r.id, 'abono', 'Cuentas por pagar - Rentas', monto_diario, creador);

      generados := generados + 1;
    END IF;

    cursor_dia := (cursor_dia + 1)::date;
  END LOOP;

  RETURN generados;
END;
$function$;

CREATE OR REPLACE FUNCTION public.devengar_asientos_rentas_activas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  rec record;
  total integer := 0;
BEGIN
  FOR rec IN
    SELECT id FROM public.obra_rentas WHERE estatus IN ('activa','devuelta')
  LOOP
    total := total + COALESCE(public.devengar_asientos_renta(rec.id), 0);
  END LOOP;
  RETURN total;
END;
$function$;
