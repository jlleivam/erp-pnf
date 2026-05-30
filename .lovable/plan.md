## Objetivo

Que al cerrar y reabrir una requisición, la pestaña Comparativa muestre exactamente lo mismo que tenías antes:

- Las tarjetas y asignaciones de proveedores que ya enviaste a autorización (o que ya están autorizadas/pagadas).
- El borrador editable en curso, aunque todavía no lo hayas mandado al supervisor.

Hoy las OCs enviadas sí están en la base de datos, pero la tarjeta no se reconstruye bien cuando la solicitud de cotización original cambia; y el borrador en curso vive solo en la memoria del navegador, así que se pierde al cerrar el panel.

## Qué cambia para el usuario

- Conforme asignas proveedores y cantidades en la Comparativa, el borrador se guarda solo en segundo plano (sin botón extra). Verás un pequeño indicador "Guardando…/Guardado" para confirmar.
- Si cierras el panel o cambias de requisición, al volver a abrirla aparecen las mismas tarjetas (borrador + enviadas) con cantidades, precios y totales.
- Lo enviado a autorización sigue bloqueado para edición y reaparece igual aunque la cotización original del proveedor se haya descartado.
- Las acciones existentes (Enviar a supervisor, Autorizar, Rechazar, Reabrir, Quitar asignación) siguen funcionando igual.

## Cómo se logra (detalle técnico)

1. **Autoguardado del borrador en `cotizacion_paquetes`**
   - En `ComparativaTable.tsx`, un `useEffect` con debounce (~600 ms) detecta cambios en `asignaciones` para cada proveedor no bloqueado y llama a `guardarPaquete` (ya existente) con las líneas actuales.
   - `guardarPaquete` ya reusa el paquete existente del par (requisición, proveedor) cuando no tiene OC enviada, así que no se crean duplicados ni se generan OCs por accidente (la OC solo se crea al pulsar "Enviar a supervisor").
   - Se mantiene un `Map<proveedorId, fingerprint>` local para no reenviar el mismo estado.
   - Si una fila queda sin asignaciones para un proveedor que tenía paquete en borrador, se elimina ese paquete con `eliminarPaquete` (solo permite borrar borradores, nunca enviados).

2. **Reconstrucción al reabrir**
   - Se elimina la dependencia de `solicitudByProveedor` para pintar tarjetas. La fuente de verdad pasa a ser `paqueteByProveedor` + `ocByProveedor` (ya viene de `getCotizacionRequisicion`).
   - La hidratación de `asignaciones` deja de requerir una solicitud `recibida`: para cada paquete persistido se reconstruye `{ insumoId → [{ proveedorId(scId|provId), cantidad }] }` usando primero la solicitud recibida si existe; si no, se usa el `proveedor_id` del paquete como clave sintética.
   - Esto resuelve el caso reportado: aunque la cotización original ya no exista, la tarjeta y los números reaparecen porque vienen del paquete guardado.

3. **Indicador "Guardando…/Guardado"**
   - Encabezado pequeño en la sección "Pedido por proveedor" mostrando el estado del autoguardado, con manejo de errores vía `toast.error`.

4. **Bloqueos y permisos**
   - El autoguardado solo dispara para proveedores cuyo OC no está en `pendiente_autorizacion`/`autorizada`/`pagada`.
   - Sólo se ejecuta si `roles` incluye `director` o `administrativo` (mismo gate que `guardarPaquete` ya valida en el server).

## Archivos a tocar

- `src/components/requisiciones/ComparativaTable.tsx` — autoguardado debounced, hidratación basada en paquetes, indicador de estado, limpieza de paquetes borrador vacíos.
- (Posible) `src/lib/api/cotizaciones.functions.ts` — solo si hace falta exponer un helper para borrar paquetes vacíos en lote; en principio basta con `eliminarPaquete` existente.

No se requieren cambios de esquema ni migraciones.

## Validación

1. Crear asignaciones en Comparativa sin enviar → cerrar el panel → reabrir: deben reaparecer iguales.
2. Enviar una OC a supervisor → cerrar y reabrir: la tarjeta sigue como "Pendiente autorización" con sus líneas.
3. Modificar la cotización original de un proveedor después de enviar la OC: la tarjeta enviada se mantiene intacta.
4. Vaciar todas las líneas de un borrador: el paquete borrador desaparece tras reabrir.
5. Verificar que no se generan OCs hasta pulsar "Enviar a supervisor".