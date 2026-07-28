## Objetivo
Mostrar la tabla de conceptos (renglones) debajo de cada tarjeta de presupuesto en el detalle de Subcontratos, tal como se ve en Destajos.

## Cambios

**Nuevo** `src/components/subcontratos/RenglonesSubcontratoView.tsx`
- Copia del componente `RenglonesDestajoView` pero usando `getSubcontratoPresupuesto` (ya existe en `subcontratos.functions.ts`) y queryKey `["subcontrato-presupuesto", id]`.
- Misma tabla: Clave / Concepto / Unidad / Cantidad / PU / Importe + total, con manejo de renglones agrupados vía `procesarRenglones`.

**Editar** `src/components/subcontratos/SubcontratoDetalleSheet.tsx`
- Envolver cada `<PresupuestoCard>` (base y adendas) en un `<div className="space-y-2">` y renderizar `<RenglonesSubcontratoView presupuestoSubcontratoId={p.id} />` justo debajo, replicando el patrón de `DestajoDetalleSheet` (líneas 174-214).

Sin cambios en backend, tipos, ni otras vistas.