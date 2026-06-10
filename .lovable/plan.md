## Problema

En la vista de obra → Requisiciones, un usuario con rol **administrativo** ve un listado en tabla, pero:

- Al hacer click en el folio se abre solo el detalle de la requisición (sin pestañas).
- Solo aparecen botones de acción condicionales por estatus:
  - `enviada` → "Cotizar"
  - `en_cotizacion` → "Continuar"
  - `pendiente_autorizacion`, `oc_generada`, `completada` → "Ver OCs"
- Para estatus intermedios como `cotizada`, `autorizada` o `rechazada` no hay ningún botón, por lo que el administrativo **no puede acceder a Comparativa ni a OCs**.

El `CotizacionSheet` ya contiene las 4 pestañas (Requisición / Cotizaciones / Comparativa / OCs) y no las restringe por rol — el problema es solo el punto de entrada desde la tabla del administrativo.

## Cambios

Archivo: `src/components/requisiciones/RequisicionesModule.tsx` (tabla del administrativo, ~líneas 97–158)

1. **Hacer que el folio abra el módulo completo** en lugar del detalle simple:
   - Cambiar el `onClick` del `TableCell` del folio para `setCotizacion({ id: r.id, tab: "requisicion" })` en vez de `setDetalleId(r.id)`.

2. **Agregar siempre un botón "Ver"** en la columna de acción para que el administrativo pueda abrir el sheet en cualquier estatus:
   - Mantener los botones existentes (`Cotizar`, `Continuar`, `Ver OCs`) cuando aplica.
   - Para los demás estatus (`cotizada`, `autorizada`, `rechazada`, `borrador`), mostrar un botón outline **"Ver"** que abra `setCotizacion({ id: r.id, tab: "requisicion" })`.

3. No se tocan permisos ni lógica de negocio: las pestañas ya existen en `CotizacionSheet` y son visibles para todos los roles; solo se habilita el acceso desde la tabla.

## Fuera de alcance

- No se modifica `CotizacionSheet` ni las server functions.
- No se cambia la vista de tarjetas (no-administrativo).
- No se alteran permisos de autorización/edición.
