## Cambio

Bloquear edición y descarte de una respuesta de cotización cuando ya existan órdenes de compra en la requisición (cualquier OC, en cualquier estatus salvo "rechazada").

### Backend — `src/lib/api/solicitudes-cotizacion.functions.ts`
- En `capturarRespuesta`: antes de actualizar, obtener `requisicion_id` de la solicitud y contar OCs de esa requisición con `estatus <> 'rechazada'`. Si hay ≥ 1, lanzar `"Ya existen órdenes de compra; no se puede editar la respuesta."`.
- En `descartarSolicitud`: misma verificación con el mismo mensaje.

### Frontend — `src/components/requisiciones/CotizacionSheet.tsx` y `SolicitudesTab.tsx`
- Pasar `bloqueadoPorOC = ocs.some(o => o.estatus !== "rechazada")` como prop nueva a `SolicitudesTab`.
- En `SolicitudesTab` ocultar los botones "Capturar/Editar respuesta" y "Descartar" cuando `bloqueadoPorOC` sea true. Mantener "Descargar PDF" y (para borradores) "Enviar/Eliminar" — un borrador previo a las OCs es raro pero permitido.
- Mostrar una nota informativa en la parte superior de la pestaña cuando esté bloqueado: "Ya se generaron órdenes de compra; las respuestas quedan como referencia."

No se modifica esquema de BD.
