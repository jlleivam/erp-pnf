# OC: cantidad recibida + estado "Cerrada"

## Contexto

Las recepciones ya existen en `almacen_recepciones` + `almacen_recepcion_partidas` y se pueden registrar desde el módulo de almacén. La OC tiene `estatus` (`enviada` → `recibida_parcial` → `recibida`) y `estado_pago` (`pendiente`/`parcial`/`pagado`). Falta mostrar lo recibido por insumo en la tarjeta de OC y marcar la OC como **Cerrada** cuando ya se recibió todo y se liquidó al 100%.

## Cambios

### 1. Datos: traer recepciones por OC en `getCotizacionRequisicion`
Archivo: `src/lib/api/cotizaciones.functions.ts`.

Después de leer las OCs, hacer una consulta a `almacen_recepciones` filtrando por los `oc_id` de la requisición, trayendo `partidas:almacen_recepcion_partidas(insumo_id, cantidad)`. Agregar a cada OC del resultado:
- `recibido_por_insumo: Record<insumo_id, number>` (suma por insumo)
- `recepcion_completa: boolean` (cada insumo del paquete tiene `recibido ≥ pedido`)

No cambia el esquema.

### 2. UI: columna "Recibido" + estado "Cerrada" en `CotizacionSheet`
Archivo: `src/components/requisiciones/CotizacionSheet.tsx`, sección "OCs".

- Agregar columna **Recibido** a la tabla de insumos de la OC, mostrando `recibido / pedido unidad` (verde si `recibido ≥ pedido`, ámbar si `0 < recibido < pedido`, gris si `0`).
- Calcular `cerrada = recepcion_completa && estado_pago === "pagado"`.
- Si `cerrada`, reemplazar el badge de estatus por **Cerrada** (estilo emerald) y ocultar el badge de pago (ya implícito). Mantener el resto de badges intactos para OCs abiertas.
- Texto del estatus actual cambia: "Enviada al proveedor" deja de mostrarse cuando la OC está cerrada; en su lugar se muestra "Cerrada · {fecha más reciente entre última recepción y último pago}".

### 3. Habilitar "Registrar recepción" desde la tarjeta de OC
Hoy el botón está deshabilitado. Conectarlo al `RecepcionDialog` existente (`src/components/almacen/RecepcionDialog.tsx`), pasándole `ocId`. Se muestra solo cuando `estatus ∈ {enviada, recibida_parcial}` y el usuario tiene rol con acceso a la obra (director/administrativo/supervisor — mismo criterio que el módulo de almacén). Al cerrar el diálogo, invalidar `["cotizacion", requisicionId]` y `["pagos-oc", ocId]`.

### 4. Estado "Cerrada" — alcance
**Computado**, no persistido. La condición `recepcion_completa && estado_pago === "pagado"` se evalúa en cada lectura. Razones: el `estatus` actual ya pasa a `recibida` automáticamente al completarse la recepción, y `estado_pago` ya se actualiza en `registrarPagoOC`/`cancelarPagoOC`. Una OC "cerrada" puede des-cerrarse si se cancela un pago o se anula una recepción, lo cual con un campo persistido requeriría triggers adicionales. Si más adelante se necesita reporte histórico de cierre, se agrega `cerrada_at` en una migración separada.

## Fuera de alcance

- No se crea un nuevo estatus en BD (`ordenes_compra.estatus` sigue igual).
- No se modifica `registrarRecepcion` ni `registrarPagoOC`.
- No se toca el flujo de notificaciones.
- No se afecta el cálculo de saldos por proveedor (sigue basado en `monto_pagado`).
