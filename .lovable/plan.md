# Permisos en Órdenes de Compra y Cotización

Cablear el catálogo de permisos al flujo de cotización y OC, tanto en UI como en servidor.

## Cambios de catálogo (`src/lib/permisos/catalogo.ts`)
- Agregar `cotizaciones.gestionar` — módulo "Órdenes de compra", default administrativo.
- Mantener `oc.crear`, `oc.autorizar`, `oc.cancelar`. Cambiar defaults:
  - `oc.autorizar`: default supervisor (hoy es NONE) para no romper el flujo actual.
  - `oc.cancelar`: default administrativo (ya está).

## Mapeo de acciones

| Acción | Permiso |
|---|---|
| Crear/editar/eliminar solicitud de cotización, marcar SC enviada, capturar respuesta, descartar solicitud, guardar/eliminar paquete | `cotizaciones.gestionar` |
| Generar OC desde comparativa, enviar OC a supervisor | `oc.crear` |
| Autorizar OC | `oc.autorizar` |
| Rechazar OC, reabrir OC, cancelar OC desde `CotizacionSheet` | `oc.cancelar` |

Desacopla de `requisiciones.aprobar`/`requisiciones.rechazar` (que quedan sólo para el flujo de aprobación de la requisición en sí).

## Cambios en cliente

1. `src/components/requisiciones/SolicitudesTab.tsx`
   - `puedeGestionar = can("cotizaciones.gestionar")`. Oculta/deshabilita botones de crear/editar/eliminar solicitud, marcar enviada, capturar respuesta y descartar.

2. `src/components/requisiciones/CapturarRespuestaDialog.tsx`
   - Bloquear submit si `!can("cotizaciones.gestionar")`.

3. `src/components/requisiciones/ComparativaTable.tsx`
   - `puedeGenerarOC = can("oc.crear")` para el botón "Generar OC".
   - `puedeAutorizar = can("oc.autorizar")`, `puedeRechazar = can("oc.cancelar")` (reemplaza los actuales `requisiciones.aprobar/rechazar`).

4. `src/components/requisiciones/CotizacionSheet.tsx`
   - `puedeCancelarOC = can("oc.cancelar")` (hoy usa `requisiciones.rechazar`).
   - Botón "Reabrir OC" gated por `oc.cancelar`.

5. `src/routes/_authenticated/app.supervisor.requisiciones.tsx` y sidebar en `AppShell.tsx`
   - Ampliar gate a `can("requisiciones.aprobar") || can("requisiciones.rechazar") || can("oc.autorizar") || can("oc.cancelar")` para que supervisores con permisos de OC sigan viendo la pantalla.

## Cambios en servidor (defensa en profundidad)

`src/lib/api/solicitudes-cotizacion.functions.ts` — `requirePermission(..., "cotizaciones.gestionar")` en:
- `crearSolicitud`, `actualizarSolicitud`, `eliminarSolicitud`, `marcarSCEnviada`, `capturarRespuesta`, `descartarSolicitud`.

`src/lib/api/cotizaciones.functions.ts`:
- `guardarPaquete`, `eliminarPaquete` → `cotizaciones.gestionar`.
- `generarOC`, `enviarOCASupervisor` → `oc.crear`.
- `autorizarOC` → `oc.autorizar` (reemplaza `requisiciones.aprobar`).
- `rechazarOC`, `reabrirOC` → `oc.cancelar` (reemplaza `requisiciones.rechazar`).
- `enviarOCAProveedor` → `oc.crear`.

## Fuera de alcance
- RLS de `ordenes_compra`, `cotizacion_solicitudes`, `cotizacion_paquetes` (sigue el modelo aplicativo).
- Cambios de negocio en el flujo de comparativa; sólo se cablean los gates.
- Pruebas E2E.
