## Cambios en la tabla de Subcontratos

### 1. Backend — `src/lib/api/subcontratos.functions.ts` (`listSubcontratos`)
- Quitar el filtro `.eq("estatus", "cerrada")` al traer estimaciones y, en su lugar, calcular dos acumulados:
  - `estimado_acumulado` = suma de `monto_total` de **todas** las estimaciones (cualquier estatus).
  - `pagado_acumulado` = suma de `monto_total` solo de estimaciones con estatus `cerrada` (comportamiento actual).
- Exponer ambos campos en el objeto devuelto.

### 2. UI — `src/components/subcontratos/SubcontratosModule.tsx`
- **Encabezados de tabla**: reemplazar la columna `Acciones` por `Estimado`. Orden final:
  `# · Subcontrato · Contratista · Estatus · Contratado · Estimado · Pagado`
- **Celdas**: agregar celda `Estimado` con `formatMXN(d.estimado_acumulado)` (alineada a la derecha, tabular-nums). Eliminar la celda de acciones (botón "Abrir" + botón eliminar).
- **Fila clickeable**: agregar `onClick={() => setViewingId(d.id)}` y clases `cursor-pointer hover:bg-muted/40` al `<tr>` para abrir el detalle al hacer click en cualquier parte.
- **Eliminar borrador**: como el botón de basura vivía en la columna de acciones, mover esa acción al `SubcontratoDetalleSheet` no es necesario — ya existe la acción de eliminar dentro del detalle. Si no existe, conservar solo ese botón en una mini-celda dedicada queda fuera de alcance; el botón se elimina de la lista (los borradores se podrán seguir eliminando desde el sheet de detalle, que ya soporta `eliminarSubcontrato`).
- Ajustar los anchos de columna (`w-[%]`) para repartir el espacio liberado por la columna Acciones.

### 3. Sin cambios
- KPIs superiores (Contratado vigente / Pagado acumulado / Subcontratos activos).
- Permisos, server functions de mutación, sheets de detalle/captura.
- Módulo de destajos (este cambio aplica solo a subcontratos).
