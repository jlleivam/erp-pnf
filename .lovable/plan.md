# Tres correcciones en OC

## 1. Administrativo no debe ver "Registrar recepción"

**Causa**: el backend (`getCotizacionRequisicion`) calcula `puede_recibir` con los roles **reales** del usuario. Cuando el director simula ser administrativo, sus roles reales siguen siendo `director`, así que el backend devuelve `puede_recibir=true` y el botón aparece.

**Fix**: en `src/components/requisiciones/CotizacionSheet.tsx`, dejar de usar `oc.puede_recibir` para mostrar el botón. En su lugar gatear por `useEffectiveRoles()`:

```ts
const puedeRecibirUI = roles.includes("director") || roles.includes("residente");
const puedeRecibir =
  puedeRecibirUI &&
  (oc.estatus === "enviada" || oc.estatus === "recibida_parcial") &&
  !cerrada;
```

El backend (`registrarRecepcion`) ya valida estrictamente (director real o residente real de la obra), así que la seguridad no cambia.

## 2. OC pagada al 100% sigue mostrando "Registrar pago"

**Causa**: `ordenes_compra.total` se guarda con precisión completa (ej. `2301.7241379310344`) pero los pagos se capturan a 2 decimales (`2301.72`). En `registrarPagoOC` se compara `nuevoPagado >= total - 0.001`, y la diferencia real es `~0.004 > 0.001`, por lo que `estado_pago` se queda en `parcial` y el UI sigue mostrando "Registrar pago".

**Fix (código)** en `src/lib/api/pagos.functions.ts`, función `registrarPagoOC`:
- Subir la tolerancia a **1 centavo** (`0.01`):
  - `if (data.monto > pendiente + 0.01)` (línea 75)
  - `nuevoPagado >= total - 0.01 ? "pagado" : "parcial"` (línea 139)
- Lo mismo en `cancelarPagoOC` si compara con `0.001`.

**Fix (datos)**: migración de backfill para OCs ya afectadas:

```sql
UPDATE public.ordenes_compra
SET estado_pago = 'pagado',
    pagada_at = COALESCE(pagada_at, now())
WHERE estado_pago = 'parcial'
  AND monto_pagado >= ROUND(total::numeric, 2) - 0.01;
```

## 3. Badge dice "Pago parcial" cuando se pagó en una sola exhibición

**Misma causa que 2**. Una vez que `estado_pago` quede en `pagado`, el badge cambia automáticamente a "Pagada" (la UI ya tiene esa lógica).

Adicional en UI: en `CotizacionSheet`, cuando `pagado + 0.01 >= total` mostrar "Pagada" aunque el campo aún dijera `parcial` (red de seguridad para registros viejos):

```ts
const fullyPaid = estadoPago === "pagado" || pagado + 0.01 >= total;
```

Usar `fullyPaid` para el badge y para `puedePagar`.

## Fuera de alcance

- No se cambia `assertObraAccess` ni los permisos de almacén/movimientos.
- No se altera el cálculo de saldos por proveedor.
- No se cambia la captura/redondeo de `total` al generar la OC (cualquier OC nueva se cierra correctamente con la tolerancia de 1 centavo).
