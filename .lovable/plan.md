## Objetivo
Convertir la pestaña Historial del proveedor en un **estado de cuenta contable** que muestre claramente el saldo pendiente con ese proveedor y el detalle de los movimientos que lo generan (cargos por OCs recibidas y abonos por pagos registrados).

## Modelo del estado de cuenta
Por cada proveedor:
- **Cargos**: cada orden de compra (OC) aparece como un cargo por su total. Se usa `ordenes_compra.total` y `created_at` (o `fecha` si existe) como fecha del movimiento.
- **Abonos**: cada pago aplicado a una OC de ese proveedor aparece como abono. Se leen desde la tabla `pagos` (cruzando con `ordenes_compra.proveedor_id`).
- **Saldo corriente** = Σ cargos − Σ abonos, calculado en orden cronológico.

Esto coincide con cómo el módulo de Cuentas por pagar ya calcula el saldo del proveedor (`getSaldosProveedores`), así que los totales del header (Ordenado / Pagado / Saldo) van a empatar.

## Cambios

### 1. Nuevo server function en `src/lib/api/terceros.functions.ts`
`getEstadoCuentaProveedor({ terceroId })`:
- `.middleware([requireSupabaseAuth])`
- Verifica que el tercero pertenezca a `company_id` del usuario.
- Trae OCs del proveedor: `id, folio, created_at, total, monto_pagado, estado_pago, obra:obras(id,nombre)`.
- Trae pagos asociados a esas OCs: `id, fecha, monto, referencia, oc_id, metodo, cuenta_id, cuenta:cuentas(nombre)`.
- Construye un arreglo de movimientos `{ fecha, tipo: "cargo"|"abono", concepto, referencia, cargo, abono, ocId, ocFolio }`, ordenado por fecha asc y calcula `saldo` corrido.
- Devuelve `{ totales: { ordenado, pagado, saldo }, movimientos }`.

### 2. UI en `TerceroDetalle.tsx` (pestaña Historial)
Reemplazar la Card placeholder de "Órdenes de compra recientes" por un bloque "Estado de cuenta":
- **Tarjetas resumen** arriba: Total ordenado · Total pagado · **Saldo pendiente** (rojo si > 0, verde si 0).
- **Tabla de movimientos** debajo, una línea por movimiento con tooltips para texto truncado (mismo patrón de Cuentas por pagar):
  - Columnas: Fecha · Tipo (badge "Cargo"/"Abono") · Folio/Referencia · Concepto (OC + obra, o método de pago + cuenta) · Cargo · Abono · Saldo.
  - Saldo en negritas, color rojo si > 0.
  - Estado vacío: "Sin movimientos contables con este proveedor".
- Loading: "Cargando…".

La Card de "Historial de precios por insumo" se deja como placeholder (otra iteración). La Card de "Contratos" del contratista se mantiene como está.

## Fuera de alcance
- Filtros por fecha / exportar a PDF/Excel del estado de cuenta.
- Conciliar contra `asientos_contables` (no todos los pagos generan asiento ahí; el estado de cuenta se construye de OCs y `pagos`, consistente con CxP).
- Historial de precios por insumo.

## Notas técnicas
- Confirmar columnas reales de `pagos` y `ordenes_compra` antes de codear (vía `supabase--read_query`).
- Respetar RLS: usar `context.supabase` (no admin); ya está limitado por `company_id` vía las políticas existentes.