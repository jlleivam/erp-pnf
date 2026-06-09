## Objetivo

Notificar al Residente (quien envió la OC) cuando el Supervisor autorice o rechace una OC de presupuesto, destajo o subcontrato.

## Alcance

Tres pares de handlers en server functions ya existentes:

- `autorizarPresupuesto` y `rechazarPresupuesto` en `src/lib/api/presupuestos.functions.ts`
- `autorizarPresupuestoDestajo` y `rechazarPresupuestoDestajo` en `src/lib/api/destajos.functions.ts`
- `autorizarPresupuestoSubcontrato` y `rechazarPresupuestoSubcontrato` en `src/lib/api/subcontratos.functions.ts`

Solo cuando `tipo === "adenda"` (es OC, no presupuesto base).

## Destinatario

- El `enviado_por` (Residente solicitante) leído de la OC. Si coincide con quien autoriza/rechaza (ej. Director resolviendo su propia OC), no se envía notificación.

## Contenido

Extender el helper `notifySupervisoresOC` o agregar `notifyResidenteOC` en `src/lib/api/_oc-notify.server.ts`. Por destinatario:

- Autorizada:
  - `tipo`: `"oc_presupuesto_autorizada"` / `"oc_destajo_autorizada"` / `"oc_subcontrato_autorizada"`
  - `titulo`: `"OC autorizada"`
  - `mensaje`: `"{Supervisor} autorizó tu OC de {presupuesto|destajo|subcontrato} en la obra {obra.nombre}."`
- Rechazada:
  - `tipo`: `"oc_presupuesto_rechazada"` / `"oc_destajo_rechazada"` / `"oc_subcontrato_rechazada"`
  - `titulo`: `"OC rechazada"`
  - `mensaje`: `"{Supervisor} rechazó tu OC en la obra {obra.nombre}. Motivo: {motivo}"`
- `link`: `/app/obras/{obra_id}/presupuesto` (presupuesto) o `/app/obras/{obra_id}` para destajo/subcontrato — misma convención que la fase anterior.

Insert vía `supabaseAdmin` envuelto en try/catch (no romper el flujo si falla).

## Detalles técnicos

- En los handlers de autorización: leer también `enviado_por` (en presupuestos.functions.ts ya carga `obra_id, tipo, estatus` — agregar el campo).
- Agregar función `notifyResidenteOC(supabase, { residenteId, actorUserId, obraId, tipo, link, motivo? })` en `_oc-notify.server.ts` reusando la lógica de fetch de `obra` y nombre del actor.
- Sin cambios de esquema ni de UI: `NotificacionesBell` los muestra automáticamente.

## Fuera de alcance

- No se envían correos ni push.
- No se notifica a otros miembros de la obra ni al Director.
