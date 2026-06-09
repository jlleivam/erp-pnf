## Objetivo

Introducir el flujo de **solicitud de pago de anticipo de destajo**. Hoy el residente puede marcar directamente el anticipo como pagado; queremos que:

1. El residente **solicite el pago** del anticipo (no lo marque pagado).
2. La solicitud aparezca al **administrativo** en **Cuentas por pagar**, en una nueva sección dedicada a anticipos de destajo.
3. El administrativo sea quien registre el pago efectivo (marcar pagado / liquidar contra una cuenta).

Esta es la base sobre la que después se podrán colgar otras solicitudes (estimaciones de destajo, etc.) con el mismo patrón.

## Cambios

### 1. Base de datos — migración

Tabla `obra_destajo_anticipos`: agregar columnas de estado de solicitud.

- `solicitado_at timestamptz null`
- `solicitado_por uuid null references auth.users(id)`
- `solicitud_notas text null`

Estado derivado en el cliente:
- `pagado = true` → **Pagado**
- `solicitado_at not null && !pagado` → **Solicitado** (pendiente en CxP)
- `else` → **Por solicitar**

Sólo permitir solicitar cuando:
- el destajo tiene `presupuesto base autorizado`
- `anticipo_monto > 0`
- `pagado = false`
- `solicitado_at IS NULL` (no se ha solicitado aún)

(No se agregan policies nuevas: las existentes ya permiten al residente/director leer y actualizar; el administrativo es director o tiene acceso por company.)

### 2. Server functions (`src/lib/api/destajos.functions.ts`)

- **`solicitarPagoAnticipoDestajo({ destajoId, notas? })`**
  - Verifica que el usuario sea residente de la obra o director de la empresa.
  - Verifica precondiciones (presupuesto base autorizado, anticipo_monto > 0, no pagado, no solicitado).
  - Actualiza `obra_destajo_anticipos` con `solicitado_at = now()`, `solicitado_por = userId`, `solicitud_notas`.
  - Genera notificación dirigida a usuarios con rol `administrativo` / `director`:
    `"Solicitud de pago de anticipo · {destajo.numero} {destajista.nombre} · {formatMXN(monto)}"` con link a Cuentas por pagar.

- **`cancelarSolicitudAnticipoDestajo({ destajoId })`** (opcional, recomendable)
  - Sólo el residente que solicitó o el director, mientras no esté pagado.
  - Limpia `solicitado_at`, `solicitado_por`, `solicitud_notas`.

- **`listAnticiposDestajoPendientes()`**
  - Para administrativo/director. Devuelve solicitudes con `solicitado_at not null` y `pagado = false` de la empresa actual.
  - Join con `obra_destajos`, `obras`, y trabajador (destajista) para mostrar contexto.

- `marcarAnticipoPagado` existente: añadirle prerequisito de `solicitado_at not null` (no se puede pagar sin solicitud previa). Mantener el resto del comportamiento (registrar `pagado_at`, opcionalmente cuenta_id/metodo si se decide).

### 3. UI Residente — `DestajoDetalleSheet` (pestaña Términos)

En la tarjeta de Anticipo:
- Si el anticipo está **por solicitar** y `canEdit` (residente o director): mostrar botón **"Solicitar pago de anticipo"** que abre un mini-diálogo con campo opcional de notas.
- Si está **solicitado**: badge `Solicitado` + fecha + nombre de quien solicitó + (si es el solicitante o director) botón discreto "Cancelar solicitud".
- Si está **pagado**: el badge `Pagado` actual.
- **Eliminar** el botón directo "Marcar pagado" de esta vista (esa acción ahora vive en Cuentas por pagar).

### 4. UI Administrativo — `CuentasPorPagarModule`

Convertir el módulo a **pestañas** (`Tabs`):
- Pestaña **Proveedores (OC)** — el contenido actual sin cambios.
- Pestaña **Anticipos de destajo** — nueva:
  - Tabla: Obra · Destajo · Destajista · Monto · Solicitado el · Solicitado por · acción.
  - Acción **"Registrar pago"** → diálogo que reutiliza el mismo patrón que `RegistrarPagoOCDialog` (cuenta, método, fecha, referencia) y al confirmar invoca `marcarAnticipoPagado` (lo extenderemos para aceptar `cuentaId`, `metodo`, `fecha`, `referencia` y crear el `cuenta_movimiento` correspondiente, igual que `pagos.functions.ts` ya hace para OC).
  - Total de la pestaña en el header.

### 5. Notificaciones

Reutilizar `notificaciones` con tipo `anticipo_destajo_solicitado` apuntando al destajo y a la sección Cuentas por pagar. (Si el destinatario está viendo CxP, además se invalida la query.)

## Notas técnicas

- Los anticipos no pasan por `ordenes_compra`, por lo que en la pestaña de CxP **no** se agregarán a los saldos por proveedor; quedan en un listado propio. El "Pendiente total" del header pasará a ser un total combinado (OC + anticipos) o se mostrará un total por pestaña — me inclino por **total por pestaña** para no mezclar conceptos.
- `marcarAnticipoPagado` al registrar el pago real:
  - inserta `pagos` (`origen_tipo = 'anticipo_destajo'`, `origen_id = anticipo.id`),
  - inserta `cuenta_movimientos` egreso ligado al pago,
  - actualiza `cuentas.saldo_actual`,
  - setea `obra_destajo_anticipos.pagado = true, pagado_at = now(), metodo_pago, referencia`.
- Validaciones de cuenta idénticas a OC (caja_fuerte → efectivo, bancaria → no efectivo, cuenta activa).
- No se tocan los renglones del presupuesto ni el cálculo de amortización; el saldo a amortizar sigue siendo `anticipo_monto`.

## Flujo resultante

```text
Residente (Términos del destajo)
   └── Solicitar pago de anticipo  ──►  notificación a administrativo
                                            │
                                            ▼
Administrativo (Cuentas por pagar → Anticipos de destajo)
   └── Registrar pago (cuenta, método, referencia)
            │
            ▼
   anticipo.pagado = true, pago + movimiento de cuenta creados
```

¿Procedo a implementarlo así?
