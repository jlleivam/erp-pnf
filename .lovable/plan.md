# Flujo de autorización de Destajos (3 estados)

## Estado actual

La tabla `obra_destajo_presupuestos` (presupuesto base de cada destajo) ya tiene el ciclo `borrador → enviado → autorizado/rechazado` con `enviarPresupuestoDestajo`, `autorizarPresupuestoDestajo` y `rechazarPresupuestoDestajo`. Lo que falta para que coincida con el flujo descrito:

1. Al **enviar** una base (no sólo adendas) no se notifica a supervisores.
2. Al **autorizar** o **rechazar** una base no se notifica al residente.
3. Al **rechazar** una base queda en estado `rechazado` (requiere "reabrir"). El usuario pide que vuelva directamente a `borrador`.
4. La UI muestra "Pendiente autorización"; debe decir "Por autorizar".
5. Las notificaciones deben llevar al detalle del destajo y abrir el visor del presupuesto base autorizado/rechazado.

No se necesitan cambios de esquema — `notificaciones.tipo` es `text` libre, y los tres estados ya existen en el enum `destajo_doc_estatus`.

## Cambios

### Backend: `src/lib/api/_oc-notify.server.ts`
Agregar soporte para tipos nuevos sin tocar los existentes:
- `destajo_solicitado` (residente → supervisores)
- `destajo_autorizado` (supervisor → residente)
- `destajo_rechazado` (supervisor → residente, con motivo)

Ampliar `notifySupervisoresOC` y `notifyResidenteOC` para aceptarlos, con títulos/mensajes específicos ("Nuevo destajo por autorizar", "Destajo autorizado", "Destajo rechazado").

### Backend: `src/lib/api/destajos.functions.ts`
- `enviarPresupuestoDestajo`: cuando `tipo === "base"`, después del update notificar a supervisores con `destajo_solicitado` y `link = /app/obras/{obraId}/destajos?destajo={destajoId}`.
- `autorizarPresupuestoDestajo`: cuando `tipo === "base"`, notificar al residente que envió (`p.enviado_por`) con `destajo_autorizado` y el mismo link.
- `rechazarPresupuestoDestajo`: cuando `tipo === "base"`, en lugar de marcar `estatus: "rechazado"`, regresarlo a `borrador` limpiando `enviado_at/por`; guardar `rechazo_motivo` y `rechazado_at/por` para mostrar la razón. Notificar al residente con `destajo_rechazado` y el motivo. Las adendas mantienen el comportamiento actual.

### UI: `src/components/destajos/DestajoDetalleSheet.tsx`
- Cambiar etiqueta del estatus `enviado` de "Pendiente autorización" a **"Por autorizar"** sólo para la base; las adendas pueden seguir igual.
- En la fila de la base, mostrar el `rechazo_motivo` cuando exista aunque el estado sea `borrador` (es el caso "rechazado → vuelto a borrador").
- Quitar el botón "Reabrir como borrador" para la base, ya que el rechazo regresa directo a borrador.

### UI: `src/components/destajos/DestajosModule.tsx`
- Aceptar query param `?destajo={id}` para abrir automáticamente `DestajoDetalleSheet` con ese destajo al llegar desde una notificación.

## Sin cambios
- Estimaciones siguen requiriendo base `autorizado`.
- Flujo de adendas (OC de destajo) intacto.
- No se modifican migraciones ni RLS.
