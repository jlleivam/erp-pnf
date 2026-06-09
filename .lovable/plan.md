## Compactar tabla del panel global de nómina

Archivo: `src/components/nomina/NominaAdminPanel.tsx`

Cambios en la tabla principal (no en el diálogo de detalle):

1. **Eliminar la columna "Estado"**: remover el `<th>` y la `<td>` correspondientes. El indicador de duplicados se preserva tintando la fila en rojo (ya existe) y mostrando un ícono pequeño de `AlertTriangle` junto al nombre del trabajador cuando `t.duplicados.length > 0`.

2. **Una sola línea por trabajador**:
   - Nombre y puesto en la misma celda, en línea: `Nombre · puesto` (puesto en `text-xs text-muted-foreground`) en lugar de dos renglones apilados.
   - Celda "Obras": cambiar `flex-wrap` por `flex` con `truncate`/`whitespace-nowrap` y `overflow-hidden`, mostrando los badges en una sola línea (con `min-w-0` en la celda). Si hay varias obras se recortan con ellipsis.
   - Reducir padding de celdas de `p-3` a `py-2 px-3` y tamaño de fuente general a `text-sm` (ya está) — los badges de obra a `text-[11px]`.

3. **Sin cambios** en encabezado, filtros, totales, ni en el diálogo de detalle.
