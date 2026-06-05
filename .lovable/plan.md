# Compactar tabla de captura de estimación

Aplicar el mismo tratamiento que `VerPresupuestoSheet` a la tabla de `src/components/estimaciones/CapturaEstimacionSheet.tsx`.

## Cambios

1. **Tipografía y densidad**
   - Tabla: `text-sm` → `text-xs`.
   - Encabezado: `text-xs` → `text-[11px]`.
   - Celdas: `p-2` → `px-2 py-1`. Input de cantidad: alto `h-7` (en lugar de `h-8`) con `text-xs`.

2. **Una línea por concepto**
   - `table-fixed` con `<colgroup>` de anchos fijos para todas las columnas excepto Concepto.
   - Concepto: `max-w-0`, contenido envuelto en `Tooltip` (`@/components/ui/tooltip`) con `truncate whitespace-nowrap overflow-hidden text-ellipsis cursor-default`; tooltip muestra el concepto completo.
   - Resto de celdas: `whitespace-nowrap`.
   - Envolver tabla en `TooltipProvider delayDuration={200}`.

3. **Anchos sugeridos**
   - Clave 24 · Concepto (flex) · Un. 14 · Cant. vig. 20 · Acum. previo 20 · Esta semana 24 · Importe sem. 28 · % Acum. 16.

## Fuera de alcance

- No se cambian StatCards, filtros, acciones (Guardar/Cerrar), ni la lógica de cálculo o validaciones.
- No se aplica a otras pantallas (destajos, subcontratos, OC) en este turno.
