## Objetivo

El monto contratado de una obra debe reflejar el total del presupuesto autorizado (base + órdenes de cambio autorizadas), no capturarse manualmente.

## Cambios

### 1. Auto-calcular `obras.monto_contratado` desde los presupuestos

En `src/lib/api/presupuestos.functions.ts`, añadir un helper `recalcularMontoContratado(supabase, obraId)` que:
- Sume `monto_total` de `obra_presupuestos` de la obra con `estatus = 'autorizado'` (presupuesto base + órdenes de cambio, ya que las OC guardan su delta en `monto_total`).
- Haga `UPDATE obras SET monto_contratado = <suma>` para esa obra.

Invocarlo al final de:
- `autorizarPresupuesto` (cuando se autoriza el base o una OC)
- `eliminarPresupuesto` (por si se borra uno autorizado)
- `cargarRenglones...` (opcional) — solo si el presupuesto ya estaba autorizado, para mantenerlo en sync.

### 2. Configuración de obra → "Datos generales"

En `src/routes/_authenticated/app.obras.$obraId.configuracion.tsx` (`DatosTab`):
- Reemplazar el `Input type="number"` de "Monto contratado" por una vista de solo lectura: muestra `formatMXN(initial.monto_contratado)` con leyenda *"Se calcula automáticamente a partir del presupuesto autorizado y sus órdenes de cambio."* y un enlace a la pestaña Presupuesto del dashboard.
- Quitar el estado `montoContratado` y dejar de enviarlo en `actualizarObra`.

### 3. Wizard "Nueva obra"

En `src/routes/_authenticated/app.obras.nueva.tsx`:
- Eliminar el campo "Monto contratado (MXN)" del Paso 1 y el estado/payload asociado. El monto quedará en `null` hasta que se autorice un presupuesto.

### 4. Server functions

En `src/lib/api/obras.functions.ts`:
- En el schema/handler de `actualizarObra`, quitar `monto_contratado` (o dejarlo ignorado) para que el cliente no pueda sobreescribirlo.
- En `crearObra`, quitar `monto_contratado` del input (se inicializará en `null`).

No se requiere migración de DB: la columna `monto_contratado` se mantiene, solo cambia quién la escribe.

## Archivos a modificar

- `src/lib/api/presupuestos.functions.ts` — helper + llamadas en autorizar/eliminar.
- `src/lib/api/obras.functions.ts` — quitar `monto_contratado` de inputs de crear/actualizar.
- `src/routes/_authenticated/app.obras.$obraId.configuracion.tsx` — campo de solo lectura.
- `src/routes/_authenticated/app.obras.nueva.tsx` — quitar input del wizard.

## Resultado

El director ya no edita el monto contratado a mano: se actualiza solo al autorizar el presupuesto base o una orden de cambio, y se muestra como dato calculado en la configuración de la obra.
