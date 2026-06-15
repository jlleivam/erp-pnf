## Cambios en `src/components/subcontratos/SubcontratosModule.tsx`

**Objetivo**: pantalla más compacta, tabla como protagonista, un subcontrato por renglón sin wrap del nombre del contratista.

### Header
- Reducir título a `text-xl` y descripción a una sola línea más corta (o `line-clamp-1`).
- Mover el botón "Nuevo subcontrato" a la fila del header (a la derecha del título) en `size="sm"`, eliminando el bloque vertical que hoy ocupa mucho espacio.

### KPIs
- Compactar las 3 tarjetas: padding `p-3` en vez de `p-4`, label `text-[10px]`, monto `text-base font-semibold`.
- Mantener grid de 3 columnas pero con `gap-3`.

### Tabla (protagonista)
- Reducir padding de celdas a `p-2` (de `p-3`).
- Forzar una sola línea por subcontrato: añadir `whitespace-nowrap` + `truncate` a las celdas de texto (Subcontrato, Contratista) y darles `max-w` razonable.
- Quitar la `descripcion` debajo del nombre del subcontrato (o moverla a `title` tooltip) para garantizar 1 renglón.
- En la celda Pagado, poner monto y `%` en la misma línea (`$0.00 · 0%`) en vez de dos líneas.
- Reducir tamaño del Badge de estatus (`text-xs px-2 py-0`).
- Botón "Abrir" como `size="sm"` con menos padding; botón eliminar como ícono compacto.

### Espaciado general
- `space-y-6` → `space-y-4` en el contenedor raíz.

Sin cambios funcionales, sin cambios de API ni de datos.
