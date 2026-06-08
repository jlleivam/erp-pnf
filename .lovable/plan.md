# Fix: OC no muestra insumos

## Causa

En `src/lib/api/cotizaciones.functions.ts`, la función `getCotizacionRequisicion` carga las OCs con:

```ts
.select("id, paquete_id, folio, estatus, total, enviada_supervisor_at, enviada_proveedor_at, autorizada_at, rechazada_at, notas_supervisor, created_at, proveedor:terceros(...)")
```

No incluye el join con `cotizacion_paquetes` ni sus insumos, por lo que `oc.paquete?.items` en `CotizacionSheet` siempre es `undefined` y la tabla de insumos queda vacía. Además faltan las columnas de pago (`monto_pagado`, `estado_pago`, `pagada_at`) que el panel de pagos lee para mostrar badges y saldo.

## Cambio

Único edit en `src/lib/api/cotizaciones.functions.ts`, dentro del `select` de `ordenes_compra`:

1. Agregar columnas de pago: `monto_pagado, estado_pago, pagada_at`.
2. Agregar join al paquete con sus insumos:
   `paquete:cotizacion_paquetes(id, numero, items:cotizacion_paquete_insumos(id, cantidad, precio_unitario, subtotal, insumo:insumos(id, nombre, unidad)))`.

Con eso `oc.paquete.items` viene poblado y el render existente en `CotizacionSheet` (insumo, cantidad, p. unit, subtotal) funciona sin cambios de UI.

## Fuera de alcance

- No tocar UI ni lógica de pagos.
- No tocar otras funciones (`getCotizacionRequisicion` es la única usada por la sheet de OCs).
