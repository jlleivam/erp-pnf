## Objetivo

Cuando un Residente envía una OC a autorización (presupuesto, destajo o subcontrato), notificar al/los Supervisor(es) de la obra para que la revisen.

## Alcance

Tres server functions ya existentes que cambian la OC a estado "enviada/solicitada":

- `solicitarAutorizacionPresupuesto` en `src/lib/api/presupuestos.functions.ts`
- `enviarPresupuestoDestajo` en `src/lib/api/destajos.functions.ts` (solo cuando `tipo === "adenda"`)
- `enviarPresupuestoSubcontrato` en `src/lib/api/subcontratos.functions.ts` (solo cuando `tipo === "adenda"`)

Después del `update` exitoso al estatus enviado, insertar notificaciones siguiendo el mismo patrón usado en `requisiciones.functions.ts` / `caja-chica.functions.ts` (insert con `supabaseAdmin` dentro de try/catch para no romper la operación).

## Destinatarios

- Todos los miembros de `obra_team` con `role = 'supervisor'` de la obra correspondiente, excluyendo a `userId` (el solicitante).
- No incluimos directores por defecto — pueden ver el listado. (Confirmar si se desea agregarlos.)

## Contenido de la notificación

Por cada destinatario:

- `tipo`: `"oc_presupuesto_solicitada"` / `"oc_destajo_solicitada"` / `"oc_subcontrato_solicitada"`
- `titulo`: `"Nueva OC por autorizar"` (incluyendo nombre del destajo/subcontrato o folio/nombre de la OC cuando esté disponible)
- `mensaje`: `"{Residente} solicitó autorización de una OC en la obra {obra.nombre}."`
- `link`: ruta actual donde el supervisor revisa OCs:
  - Presupuesto: `/app/obras/{obra_id}` (sección Presupuesto/OC) — confirmar ruta exacta al implementar.
  - Destajo: `/app/obras/{obra_id}` (sección Destajos) o el detalle del destajo.
  - Subcontrato: análogo a destajo.
- `company_id`, `obra_id` poblados.

## Detalles técnicos

- Reusar el patrón de `requisiciones.functions.ts` líneas 240–268: cargar `profiles` del solicitante, `obras.nombre`, hacer `supabaseAdmin.from("notificaciones").insert([...])`.
- Envolver en `try/catch` y solo `console.error` en falla — la solicitud no debe fallar si la notificación tropieza.
- En destajo/subcontrato: solo notificar cuando `p.tipo === "adenda"` (cuando es base, no es OC).
- No hay cambios en esquema: `notificaciones` ya tiene `obra_id`, `tipo`, `titulo`, `mensaje`, `link`.

## Fuera de alcance

- No se tocan UI ni `NotificacionesBell` (ya consume `listMisNotificaciones`).
- No se notifica en rechazo/autorización (puede hacerse después si se desea).
- No se agregan emails ni push.
