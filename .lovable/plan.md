Aplicar a `src/components/clientes/CatalogoClientesModule.tsx` los mismos ajustes visuales que se hicieron a Proveedores:

## Filtros más compactos (una sola fila)
- Card de filtros: `p-3`, `gap-2`, `flex-nowrap` en `sm:` para forzar una línea.
- Input de búsqueda: `pl-8 h-8 text-xs`, con `min-w-[200px]` que crece para llenar el espacio.
- `SelectTrigger` de "Todos los tipos": `w-36 h-8 text-xs shrink-0`.
- Ícono de búsqueda dentro del input reducido acorde al `pl-8`.

## Tabla en un solo renglón
- Aplicar `whitespace-nowrap` a todos los `TableHead` y `TableCell`.
- Renombrar encabezado "Razón social" → "Nombre".
- Envolver la columna Nombre con `TruncatedCell` (`src/components/pagos/TruncatedCell.tsx`) para truncar con tooltip.
- Truncar también Teléfono y Correo con `TruncatedCell` para evitar desbordes.
- Envolver la tabla en `TooltipProvider` (ya se importa) para los tooltips de las celdas.

No se toca lógica de datos, filtros, permisos, ni el detalle/edición del cliente — solo presentación.