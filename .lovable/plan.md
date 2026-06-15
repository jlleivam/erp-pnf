## Problema

En `enviarPresupuestoSubcontrato` (src/lib/api/subcontratos.functions.ts, líneas 505–550), la notificación a Supervisores solo se dispara cuando `p.tipo === "adenda"` (orden de cambio). Cuando el Residente envía a autorización el **presupuesto base** del subcontrato (`tipo === "base"`, que es el flujo normal de "solicitar autorización del subcontrato"), el código actualiza el estatus a `enviado` pero **nunca llama a `notifySupervisoresOC`**, por eso al Supervisor no le llega nada.

## Cambio

En `enviarPresupuestoSubcontrato`, mover la llamada a `notifySupervisoresOC` fuera del `if (p.tipo === "adenda")` para que se ejecute en ambos casos, usando el tipo correcto:

- `tipo === "base"` → notificación tipo `oc_subcontrato_solicitada` con título genérico ("Nuevo subcontrato por autorizar"), o se puede reutilizar el mismo tipo existente. Como el helper `notifySupervisoresOC` solo acepta los tipos ya definidos, lo más limpio es enviar `oc_subcontrato_solicitada` también para el base (el mensaje dirá "solicitó autorización de una OC de subcontrato", lo cual es funcionalmente correcto para el flujo actual y consistente con cómo ya está implementado para destajos/presupuesto base).

```ts
// reemplazar el bloque `if (p.tipo === "adenda") { ... }` por:
try {
  await notifySupervisoresOC(supabase, {
    userId,
    obraId: d0!.obra_id,
    tipo: "oc_subcontrato_solicitada",
    link: `/app/obras/${d0!.obra_id}`,
  });
} catch (e: any) {
  console.error("[notificaciones] oc_subcontrato_solicitada error", e?.message);
}
```

## Alcance

- Un único archivo: `src/lib/api/subcontratos.functions.ts`.
- Sin cambios de esquema, sin cambios de UI.
- No toca el flujo de autorización/rechazo (esos ya notifican correctamente al Residente).

## Validación

Después del cambio, al enviar a autorización un subcontrato base, los Supervisores de la obra deben recibir una notificación visible en la campana (`NotificacionesBell`) con link a la obra.
