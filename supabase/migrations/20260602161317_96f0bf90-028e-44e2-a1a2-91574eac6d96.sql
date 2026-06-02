ALTER TABLE public.cotizacion_paquete_insumos
  ADD CONSTRAINT cotizacion_paquete_insumos_insumo_id_fkey
  FOREIGN KEY (insumo_id) REFERENCES public.insumos(id) ON DELETE RESTRICT;

ALTER TABLE public.almacen_recepcion_partidas
  ADD CONSTRAINT almacen_recepcion_partidas_insumo_id_fkey
  FOREIGN KEY (insumo_id) REFERENCES public.insumos(id) ON DELETE RESTRICT;

ALTER TABLE public.almacen_movimientos_semana
  ADD CONSTRAINT almacen_movimientos_semana_insumo_id_fkey
  FOREIGN KEY (insumo_id) REFERENCES public.insumos(id) ON DELETE RESTRICT;