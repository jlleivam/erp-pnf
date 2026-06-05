# Vista compacta del presupuesto

Cambios solo en `src/components/presupuesto/VerPresupuestoSheet.tsx` (frontend/presentación).

## Cambios

1. **Una línea por concepto**
   - Forzar la fila a una sola línea: `whitespace-nowrap`, `overflow-hidden`, `text-ellipsis` en la celda de Concepto.
   - Quitar `wrap` de las demás celdas para que ninguna empuje la altura.
   - Reducir padding vertical de celdas: `py-1` en vez de `p-2` (mantener `px-2`).

2. **Tipografía un punto más pequeña**
   - Tabla: pasar de `text-sm` a `text-xs`.
   - Encabezado: pasar de `text-xs` a `text-[11px]`.
   - Mantener `tabular-nums` en cantidades/importes para alineación.

3. **Tooltip con concepto completo**
   - Envolver el texto de Concepto en `Tooltip` (`@/components/ui/tooltip`) que se muestra al hacer hover sobre la celda truncada.
   - Asegurar `TooltipProvider` (ya existe global en el shell; si no, envolver localmente).
   - El tooltip muestra el concepto completo sin truncar.

4. **Ancho controlado de columna Concepto**
   - Dar a la columna Concepto `max-w-0 w-full` dentro de una tabla con `table-fixed` (o usar `style={{maxWidth: 0}}`) para que el `text-ellipsis` funcione correctamente cuando el contenedor tenga scroll horizontal limitado.
   - Mantener anchos fijos de las otras columnas (clave, unidad, cantidad, PU, importe).

## Fuera de alcance

- No se cambia `CapturaPresupuestoSheet` ni otras tablas (estimaciones, destajos). Solo la vista de "Ver presupuesto" que el usuario está mirando.
- No se altera lógica de datos ni el server.
