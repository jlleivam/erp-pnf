## Objetivo

Eliminar la pestaña **Paquetes** y manejar todo el ciclo Paquete → OC (enviar a supervisor, autorizar, rechazar, regenerar) directamente desde el bloque **"Asignación por proveedor"** de la pestaña **Comparativa**. La pestaña **OCs** se conserva como historial/detalle.

## Comportamiento nuevo en Comparativa

El bloque "Asignación por proveedor" (hoy un resumen plano con conteo y total) se transforma en una tarjeta por proveedor con:

- Nombre del proveedor + estatus (badge: sin OC / borrador / pendiente / autorizada / rechazada).
- Lista de insumos asignados a ese proveedor con: nombre, cantidad, P.U. (precio de la cotización), subtotal.
- Total del paquete.
- Acciones según rol y estatus:
  - **Sin OC / borrador**: Director/Administrativo ve **Guardar/Actualizar paquete y OC** + **Enviar a supervisor**.
  - **Pendiente autorización**: Supervisor ve **Autorizar** y **Rechazar** (con campo motivo); Director/Administrativo ve solo el estatus + "Enviada el …".
  - **Autorizada**: badge verde con fecha, sin acciones (bloqueado).
  - **Rechazada**: muestra motivo + botón **Reabrir** (Director/Administrativo) para volver a borrador y reasignar.

## Edición tras enviar/autorizar

Las filas de insumos cuya asignación a un proveedor ya pertenece a una OC en estatus distinto de `borrador`/`rechazada` se renderizan **deshabilitadas** en la columna "Asignar a" (Select + Input + ✕ disabled), con tooltip "Insumo en OC {folio} ({estatus})". El resto de la requisición se sigue editando normal y se pueden generar OCs adicionales para los insumos no autorizados.

El botón global **"Generar paquetes con esta asignación"** se elimina; el guardado es por tarjeta de proveedor.

## Cambios por archivo

### `src/components/requisiciones/CotizacionSheet.tsx`
- Quitar `TabsTrigger value="paquetes"` y todo el `TabsContent value="paquetes"`.
- Quitar el tipo `"paquetes"` de `CotizacionTab`.
- Cambiar `onAsignacionGenerada` de `ComparativaTable` a un callback que invalide queries y muestre toast (sin cambiar de tab) — la persona se queda en Comparativa.
- En la pestaña OCs, cambiar el botón "Editar" (que hoy hace `setTab("paquetes")`) por `setTab("comparativa")`.
- Pasar a `ComparativaTable` props adicionales: `paquetes`, `ocs`, y los server fns/mutaciones necesarias (o exponer callbacks `onEnviarSupervisor`, `onAutorizar`, `onRechazar`, `onReabrir`, `onEliminarPaquete`).
- Determinar el rol del usuario actual (Director/Administrativo vs Supervisor) para condicionar acciones. Usar el endpoint/hook existente de auth o agregar uno: `getCurrentUserRoles` (server fn que devuelve `roles[]` para la company actual) en `cotizaciones.functions.ts` o en `auth.functions.ts`.

### `src/components/requisiciones/ComparativaTable.tsx`
- Recibir `paquetes`, `ocs`, `roles` por props.
- Hidratar el estado inicial de `asignaciones` a partir de `paquetes` existentes (hoy arranca vacío). Para cada paquete: para cada item, ubicar el `solicitudId` que corresponda al `proveedor_id` real del paquete y el `insumo_id`; si no se encuentra (no había cotización), tratarlo como bloqueado/solo lectura. Mantener un set `insumosBloqueados: Map<insumoId+proveedorId, ocLocked>`.
- Reescribir el bloque inferior `resumenPorSc` como tarjetas por proveedor con la lista de líneas y los botones descritos arriba.
- Quitar el botón global "Generar paquetes con esta asignación".
- Sustituir el `generarMut` actual por mutaciones por proveedor:
  - `guardarYEnviar(proveedorId)`: agrupa las asignaciones de ese proveedor, llama a `guardarPaquete` (con `paqueteId` si ya existe), luego `generarOC`, luego `enviarOCASupervisor`. Un solo botón "Enviar a supervisor".
  - `autorizar(ocId)` / `rechazar(ocId, motivo)` / `reabrir(ocId)`: nuevas server fns (ver siguiente sección).
- Deshabilitar inputs/selects en la columna "Asignar a" para los pares insumo-proveedor que estén en OC no editable.

### `src/lib/api/cotizaciones.functions.ts`
- Agregar `autorizarOC({ ocId })`: valida rol `supervisor` (o `director`), exige `estatus = pendiente_autorizacion`, set `estatus = autorizada`, `autorizada_por = userId`, `autorizada_at = now()`, recalcular estatus de requisición.
- Agregar `rechazarOC({ ocId, motivo })`: valida rol supervisor/director, exige `pendiente_autorizacion`, set `estatus = rechazada`, `rechazada_por/at`, `notas_supervisor = motivo`, recalcular.
- Agregar `getCurrentUserRoles()`: devuelve `{ roles: string[] }` de la company del usuario actual (usado por `CotizacionSheet` para decidir UI). Si ya existe equivalente reutilizarlo.
- `reabrirOC` y `enviarOCASupervisor` ya existen; reutilizar.

### Sin cambios
- Esquema de base de datos: no se requieren migraciones. El modelo `cotizacion_paquetes` + `ordenes_compra` sigue siendo el sustento; solo cambia la UI.
- `CapturarRespuestaDialog`, `SolicitudesTab`, RLS de Supabase.

## Detalles técnicos

- Hidratación de `asignaciones` desde paquetes: si un insumo aparece en un paquete cuyo `proveedor_id` no coincide con ninguna `cotizacion_solicitudes.proveedor_id` recibida, mostrarlo como entrada "solo lectura" en la tarjeta del proveedor pero ocultarlo de la matriz superior (no hay precio que comparar).
- Rol "supervisor" en RLS: las server fns de autorizar/rechazar deben aceptar `supervisor` además de `director`/`administrativo`. La política `Supervisor actualiza ordenes asignadas` ya lo permite a nivel DB.
- `recalcEstatusRequisicion` ya cubre `autorizada` → `oc_generada` cuando todas las OCs están autorizadas.
- Mantener invalidación de queries `["cotizacion", requisicionId]` y `["requisiciones"]` después de cada mutación.

## Riesgos

- Hidratar `asignaciones` desde paquetes existentes puede chocar con ediciones en curso del usuario; solo hidratar una vez al montar (flag `hydrated`), igual que ya hace `CotizacionSheet`.
- Bloquear correctamente los pares insumo×proveedor de OCs no editables es crítico para no permitir cambios silenciosos.
