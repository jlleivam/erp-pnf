# Unificar diseño del visor "Ver vigente" con `VerPresupuestoSheet`

Hacer que `VigenteViewerDialog` (el visor de presupuesto vigente que abre el botón "Ver vigente" dentro de la captura de OC) se vea idéntico al `VerPresupuestoSheet` (presupuesto base — segunda imagen).

## Cambios

Reemplazar el render actual del Dialog para que use el mismo patrón que `VerPresupuestoSheet`:

1. **Header**:
   - Título grande con badge `Autorizado` (variant `default`) al lado, y monto total alineado a la derecha con `ml-auto text-base font-semibold`.
2. **Tabla**:
   - `text-xs table-fixed` con `<colgroup>` (clave 28, concepto flex, unidad 16, cantidad 20, PU 24, importe 28).
   - Header `bg-muted/50`, `text-[11px] uppercase tracking-wider`.
   - Celdas con `px-2 py-1.5` (header) / `px-2 py-1` (filas), `tabular-nums`.
   - Columna Concepto con `truncate` + `Tooltip` (de `@/components/ui/tooltip`) para ver el texto completo en hover.
   - Filas de grupo (`es_grupo`) con `bg-muted/30 font-medium`.
   - Indentación por nivel con `paddingLeft: 0.5 + (nivel-1) * 1rem`.
   - Badges `Mod` / `Nuevo` siguen apareciendo junto a la clave.

## Archivo afectado

- `src/components/presupuesto/VigenteViewerDialog.tsx` — único archivo a modificar. Sin cambios de datos, props, ni en los tres sheets que lo usan (presupuesto/destajo/subcontrato).
