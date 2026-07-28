## Problema

En `src/lib/api/subcontratos.functions.ts` (`autorizarPresupuestoSubcontrato`, línea 676) la notificación al residente solo se dispara cuando `p.tipo === "adenda"`. Cuando se autoriza el **presupuesto base** del subcontrato no se notifica a nadie.

Destajos ya está bien: notifica `destajo_autorizado` para base y `oc_destajo_autorizada` para adenda.

## Fix

1. **`src/lib/api/_oc-notify.server.ts`**: agregar los tipos `"subcontrato_autorizado"` y `"subcontrato_rechazado"` a `TipoRespuesta` y `TIPO_LABEL_RES` (label `"subcontrato"`), y extender `esSubcontratoBase` de manera análoga a `esDestajoBase` para que el título sea "Subcontrato autorizado / rechazado" y el mensaje diga "autorizó tu subcontrato…".

2. **`src/lib/api/subcontratos.functions.ts`** en `autorizarPresupuestoSubcontrato`: mover el bloque `notifyResidenteOC` fuera del `if (p.tipo === "adenda")` y usar:
   - `tipo: p.tipo === "adenda" ? "oc_subcontrato_autorizada" : "subcontrato_autorizado"`
   - `link: /app/obras/${obraId}/subcontratos?subcontrato=${p.subcontrato_id}` (equivalente al de destajos).

3. Aplicar el mismo cambio en `rechazarPresupuestoSubcontrato` (revisar que también notifique en base con `subcontrato_rechazado`).