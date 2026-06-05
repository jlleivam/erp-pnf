## Selector de insumo con búsqueda y filtro por categoría

En `NuevaRequisicionSheet.tsx`, reemplazar el `Select` de Insumo por un patrón con lupa que abre un popover de búsqueda.

### UI
- Junto al campo de Insumo: input de solo lectura mostrando el insumo seleccionado (o "Selecciona…") + botón con ícono `Search` (lupa) a la derecha.
- Al hacer click en la lupa (o en el input), se abre un `Popover` ancho con:
  - `Command` (shadcn): `CommandInput` para autocompletar por nombre o código.
  - Selector de categoría arriba (chips horizontales scrollables o `Select` compacto) con opción "Todas".
  - `CommandList` con los insumos filtrados: muestra `nombre (unidad)` y un sub-texto con la categoría.
  - `CommandEmpty`: "Sin resultados".
- Al seleccionar, se cierra el popover y se actualiza `b.insumo_id`.

### Datos
- Cargar `listCategorias` con `useQuery` (key `["insumo-categorias"]`) cuando el sheet está abierto.
- `listInsumos` ya trae `categoria: { id, nombre }`; usar eso para filtrar en cliente por categoría seleccionada y por texto (nombre o código, case-insensitive).
- Sin cambios en server functions ni en el envío de la requisición.

### Archivos
- `src/components/requisiciones/NuevaRequisicionSheet.tsx` — único cambio.
- Usa componentes existentes: `Popover`, `Command*` (shadcn ya disponibles) y `Search` de lucide.