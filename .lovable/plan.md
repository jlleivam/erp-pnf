## Objetivo
Unificar el catálogo de Insumos con el diseño compacto usado en Clientes, Proveedores y Trabajadores (encabezado más pequeño, filtros de una sola fila con inputs `h-8 text-xs`, botones y tabla en tamaño estándar).

## Cambios en `src/components/insumos/CatalogoInsumosModule.tsx`

1. **Encabezado**
   - Cambiar `<h1 className="text-2xl ...">Insumos</h1>` por `<h2 className="text-xl font-semibold tracking-tight">Insumos</h2>` (los demás catálogos usan h2/text-xl porque el h1 "Catálogos" ya lo pinta el layout padre).
   - Mantener el subtítulo `text-sm text-muted-foreground`.
   - Botón principal "Solicitar insumo" con el mismo estilo que los otros catálogos: `className="bg-[#0f1e3d] hover:bg-[#0f1e3d]/90"` y `<Plus className="size-4 mr-1" />`.
   - Botones secundarios (Categorías, Unidades, Importar Excel) con `size="sm"` e íconos `size-4` para reducir su altura.

2. **Barra de filtros**
   - Reemplazar el bloque `Card p-4` + `flex-wrap items-end gap-3 mb-4` por el mismo patrón compacto:
     ```
     <Card className="p-3 flex flex-col sm:flex-row sm:flex-nowrap items-stretch sm:items-center gap-2">
     ```
   - Quitar los `<Label>` sobre los inputs (los otros catálogos no los usan) para poder tener todo en una sola fila.
   - Input de búsqueda: `h-8 text-xs`, ícono `size-3.5`, placeholder "Nombre o código…".
   - Selects de Categoría y Unidad: `SelectTrigger` con `w-36 h-8 text-xs shrink-0`. Se conserva la opción "Todas" y las opciones dinámicas actuales.

3. **Tabs y tabla**
   - Sacar los `Tabs` de dentro del `Card p-4` (ahora el Card es solo los filtros). Envolver la tabla en su propio `Card` como en Clientes.
   - Añadir `whitespace-nowrap` a los `TableHead` y a las celdas para mantener una fila por renglón (mismo criterio que Proveedores/Clientes).
   - Truncar la columna Nombre con `TruncatedCell` (reutilizando `@/components/pagos/TruncatedCell`) dentro de `TooltipProvider`, con `max-w-[240px]`.
   - Botones de acciones (`BarChart3`, `Pencil`, `Check`, `X`) con íconos `size-4` para igualar la densidad de los otros catálogos.

## Fuera de alcance
- No se modifica lógica de datos, permisos, mutaciones, ni los diálogos hijos (Solicitar, Editar, Categorías, Unidades, Historial, Importar).
- No se cambian rutas ni el layout `app.catalogos.tsx`.

## Verificación
- Abrir `/app/catalogos/insumos` y confirmar visualmente que encabezado, filtros, botones y tabla igualan a `/app/catalogos/clientes` y `/app/catalogos/proveedores`.
