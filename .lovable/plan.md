## Objetivo

Reducir la densidad visual del cuadro comparativo (`ComparativaTable.tsx`) sin cambiar lógica ni columnas. En la captura se ve mucho espacio vertical entre filas, headers altos y columnas anchas.

## Cambios visuales en `src/components/requisiciones/ComparativaTable.tsx`

Todo restringido a clases Tailwind, sin tocar handlers, asignaciones, validaciones ni mutaciones.

1. **Tabla densa** — envolver `<Table>` con una clase `text-xs` y reducir altura/padding de celdas:
   - Agregar a `<Table>` (línea ~542) la prop `className="text-xs [&_th]:h-8 [&_th]:py-1 [&_td]:py-1.5 [&_td]:px-2 [&_th]:px-2"`.

2. **Anchos mínimos más estrechos**:
   - `min-w-[180px]` (Insumo) → `min-w-[140px]`.
   - `min-w-[280px]` por proveedor (header colSpan=3) → `min-w-[210px]`.
   - Columna "Asignar a" `w-[240px] min-w-[220px]` → `w-[180px] min-w-[170px]`.

3. **Headers de subcolumnas** (`Cant.`, `P.U.`, `Importe`): ya son `text-xs`; reducir padding con `py-0.5`.

4. **Celda de Insumo**: quitar `font-medium` no, mantener; cambiar `text-sm` → `text-xs` y permitir wrap normal (sin cambios extra, ya wrappea).

5. **Total ofertado** (tfoot): `text-sm` → `text-xs`, mantener `font-semibold`.

6. **Asignar a — tarjetas internas**:
   - `border rounded p-1` → `border rounded p-1 gap-0.5` (ya tiene `gap-1`, bajamos a `0.5`).
   - Select trigger `h-7` → `h-6 text-[11px]`.
   - Input cantidad `h-7 w-20` → `h-6 w-16 text-[11px]`.
   - Botón eliminar `h-7 w-7` → `h-6 w-6` (icono `size-3`).
   - Botón "+ Proveedor" y "Tomar mejor precio" `h-7` → `h-6 text-[11px]`.
   - Helper de cantidad asignada: `text-xs` → `text-[11px]`.

7. **Indicadores arriba de la tabla** (insumos asignados / cubiertos): bajar de `text-sm` → `text-xs` y reducir gap del contenedor a `gap-1.5`.

## Fuera de alcance

- No cambia la estructura de columnas (sigue habiendo Cant. / P.U. / Importe por proveedor).
- No cambia lógica de candado, asignaciones, OC, ni el resumen por proveedor.
- No se introduce un modo "compacto vs cómodo" con toggle — es un cambio de densidad fijo.

## Riesgo

Mínimo. Son ajustes de clases utilitarias; si alguna celda queda demasiado apretada en datos largos (p.ej. razón social), el `truncate` ya existente lo maneja.