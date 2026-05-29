## Compactar el recuadro "Asignar a"

Reducir el ancho y la altura de cada fila de asignación en la columna "Asignar a" de `ComparativaTable.tsx`, sin cambiar la lógica de asignación.

### Cambios en `ComparativaTable.tsx` (líneas ~344–410)

1. **Contenedor de la columna**
   - Limitar el ancho de la columna agregando `w-[260px] min-w-[240px]` al `<TableCell>` de "Asignar a" (y al `<TableHead>` correspondiente) para que el espacio asignado no se infle según el dropdown.

2. **Caja por asignación** (`<div … border rounded p-1.5>`)
   - Reducir padding a `p-1` y separación a `gap-0.5`.

3. **Fila del Select de proveedor**
   - El `SelectTrigger` muestra hoy `"Macrobodega de materiales · $14.00 · 50 KG"` lo que obliga al trigger a ser ancho. Reemplazar el `<SelectValue />` por un render personalizado que muestre solo el **nombre del proveedor** truncado:
     - `<SelectTrigger className="h-7 text-xs flex-1 min-w-0">` con un `<span className="truncate">{proveedor.razon_social}</span>` en vez de `<SelectValue />`.
     - Mantener PU y cantidad disponible **solo dentro del `SelectContent`** (las opciones siguen mostrando `nombre · $PU · cant disp.`).
   - Botón ✕: `h-7 w-7`, icono `size-3`.

4. **Fila del input de cantidad**
   - Quitar las flechas nativas del `type=number` con clases utilitarias (`[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`) para no perder ancho con los spinners.
   - `Input` con `className="h-7 text-xs w-20"` (ancho fijo pequeño) en vez de ocupar todo el flex.
   - El texto auxiliar a la derecha se acorta: `"KG / 50"` en vez de `"KG / 50 disp."` y usar `text-[11px]` con `truncate`.

5. **Botón "Agregar proveedor"**
   - Cambiar a `h-7 text-xs` con label corto: `"+ Proveedor"` o mantener el icono y label actual pero con `px-2`.

6. **Indicador de progreso** (línea de "150 / 150 KG")
   - Mantener tal cual; ya cabe.

### Sin cambios

- Estado, helpers (`addAsignacion`, `updateAsignacion`, `removeAsignacion`), `tomarMejorPrecio`, `generarMut`, ni el resto de columnas. Es puramente visual.

### Archivo afectado

- `src/components/requisiciones/ComparativaTable.tsx`
