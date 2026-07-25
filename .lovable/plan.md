## Objetivo
En `CapturaPresupuestoSheet`, mantener siempre visibles el encabezado del panel, la barra de herramientas (Plantilla, Importar Excel/PDF, Agregar renglón, badge de errores/total) y los títulos de la tabla (Clave, Concepto, Unidad, Cantidad, PU, Importe). Solo el cuerpo de la tabla (los renglones) debe hacer scroll. La barra inferior con "Cerrar / Guardar borrador / Guardar y autorizar" también debe seguir fija abajo.

## Cambios (solo UI, un archivo)

`src/components/presupuesto/CapturaPresupuestoSheet.tsx`

1. Quitar `overflow-y-auto` del `SheetContent` y convertirlo en contenedor flex vertical de altura completa (`flex flex-col h-full`).
2. Estructurar el contenido en tres zonas:
   - **Header fijo**: `SheetHeader` + toolbar (los botones Plantilla / Importar Excel / Importar PDF / Agregar renglón / badge). `shrink-0`.
   - **Zona scrollable**: contenedor `flex-1 overflow-y-auto` que envuelve la `Card` con la tabla.
   - **Footer fijo**: la barra de botones Cerrar/Guardar (ya es `sticky bottom-0`, pasa a `shrink-0` dentro del flex).
3. Hacer que los `<th>` del `<thead>` sean sticky: `className="sticky top-0 z-10 bg-muted"` en cada `th` (o en el `thead` con soporte adecuado). Mantener el fondo sólido para que no se transparenten los renglones al scrollear.
4. Conservar el overlay de importación (`importing`) sin cambios funcionales.

No se toca lógica (cálculos, guardar, importar, activeRow, etc.), solo layout y clases.

## Verificación
Abrir un presupuesto con muchos renglones, hacer scroll dentro de la tabla y confirmar que:
- Los botones de la toolbar permanecen visibles arriba.
- Los títulos de columna permanecen visibles.
- Los botones Guardar permanecen visibles abajo.
- El overlay de "Analizando PDF…" sigue bloqueando la interacción.
