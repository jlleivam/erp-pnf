## Objetivo

Aplicar al visualizador de estimación (`VerEstimacionSheet`) el mismo diseño compacto que ya usa `VigenteTable` en el presupuesto vigente, para que el concepto se trunque (con tooltip) en una sola línea y las filas no crezcan verticalmente.

## Cambio

### `src/components/estimaciones/VerEstimacionSheet.tsx`

Reemplazar la tabla actual (`text-sm`, sin `table-fixed`, concepto con wrap) por el mismo patrón de `VigenteTable`:

- `<table className="w-full text-xs table-fixed">` con `<colgroup>`:
  - Clave: `w-20`
  - Concepto: flex
  - Unidad: `w-16`
  - Cant. ejec.: `w-24`
  - PU: `w-24`
  - Importe: `w-28`
- `<thead>` con `bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground`, celdas `px-2 py-1.5`.
- Celdas del cuerpo `px-2 py-1`, `tabular-nums`, `whitespace-nowrap` para columnas numéricas.
- Columna Concepto envuelta en `<TooltipProvider delayDuration={200}>` + `<Tooltip>` con `truncate whitespace-nowrap overflow-hidden text-ellipsis cursor-default`; el contenido completo aparece en el `TooltipContent` (`max-w-md whitespace-normal`).
- `td` de Concepto con `max-w-0` para forzar el truncado dentro de `table-fixed`.
- Sin cambios en datos ni en server functions: sigue mostrando `renglon_clave`, `concepto`, `unidad`, `cantidad_ejecutada`, `pu_vigente`, `importe_ejecutado`.

No se reutiliza `VigenteTable` porque las columnas y el origen de los datos son distintos (no hay grupos, ni `origen`, ni cantidades modificadas en una estimación); se replica solo el estilo.

Sin cambios en otros archivos.
