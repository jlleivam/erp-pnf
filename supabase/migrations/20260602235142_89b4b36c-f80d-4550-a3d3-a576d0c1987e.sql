ALTER TABLE public.almacen_movimientos_semana
  DROP CONSTRAINT IF EXISTS almacen_movimientos_semana_semana_id_insumo_id_key;

CREATE INDEX IF NOT EXISTS idx_almacen_mov_semana_insumo_precio
  ON public.almacen_movimientos_semana (semana_id, insumo_id, precio_unitario);