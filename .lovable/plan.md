## Problema

El diálogo "Registrar recepción" se queda en *Cargando…* porque la query del servidor falla con:

> Could not find a relationship between 'cotizacion_paquete_insumos' and 'insumos' in the schema cache

(Y un error gemelo entre `almacen_movimientos_semana` e `insumos`.)

PostgREST necesita una llave foránea declarada para resolver embeds como `insumo:insumos(...)`. Al revisar la BD, estas tres tablas tienen columnas `insumo_id uuid` pero **sin** la FK hacia `public.insumos(id)`:

- `cotizacion_paquete_insumos.insumo_id`
- `almacen_recepcion_partidas.insumo_id`
- `almacen_movimientos_semana.insumo_id`

## Solución (1 migración)

Agregar las tres llaves foráneas faltantes:

```sql
ALTER TABLE public.cotizacion_paquete_insumos
  ADD CONSTRAINT cotizacion_paquete_insumos_insumo_id_fkey
  FOREIGN KEY (insumo_id) REFERENCES public.insumos(id) ON DELETE RESTRICT;

ALTER TABLE public.almacen_recepcion_partidas
  ADD CONSTRAINT almacen_recepcion_partidas_insumo_id_fkey
  FOREIGN KEY (insumo_id) REFERENCES public.insumos(id) ON DELETE RESTRICT;

ALTER TABLE public.almacen_movimientos_semana
  ADD CONSTRAINT almacen_movimientos_semana_insumo_id_fkey
  FOREIGN KEY (insumo_id) REFERENCES public.insumos(id) ON DELETE RESTRICT;
```

Tras correr la migración, PostgREST recargará su schema cache y los embeds `insumo:insumos(...)` funcionarán. No se requieren cambios de código.

## Verificación

1. Abrir "Por recibir" → "Registrar recepción": deben listarse las partidas con nombre/unidad.
2. Abrir "Semana actual": debe cargar los movimientos con nombre del insumo.
