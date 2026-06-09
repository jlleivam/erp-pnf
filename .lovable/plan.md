## Rediseño compacto del módulo Almacén de obra

Foco: dar protagonismo a la tabla del almacén, con un insumo por renglón (sin wrap) y todas las columnas centradas excepto "Insumo".

### Cambios en `SemanaActualPanel.tsx`

1. **Header de semana más compacto**
   - Reducir card superior: `p-3`, tipografía `text-sm`, badge más pequeño.
   - Botón "Cerrar semana" en tamaño `sm`.
   - Totales (Valor recibido / utilizado) se mueven al header derecho, junto al botón, en una sola línea — desaparece la barra inferior de la tabla.

2. **Tabla densa, una fila por insumo**
   - Header: `text-xs uppercase tracking-wide`, padding `py-1.5 px-2`.
   - Celdas: `py-1.5 px-2`, `text-sm`, `whitespace-nowrap`.
   - Columna Insumo: `text-left`, `truncate max-w-[180px]` envuelto en `Tooltip` con el nombre completo (igual patrón que requisiciones).
   - Resto de columnas (Proveedor, Unidad, PU, Inv. inicial, Recibido, Utilizado, Inv. final): `text-center` con `tabular-nums` en numéricas.
   - Proveedor: también `truncate max-w-[140px]` + Tooltip para evitar wrap de "Aceros Alcalde".
   - Input de Utilizado: `h-7 w-20 text-center mx-auto` (más chico, centrado en la celda).
   - `TooltipProvider` envolviendo el panel.

3. **Sin cambios funcionales**
   - Lógica de guardado, mutaciones, cierre de semana, totales y validaciones permanecen idénticas.

### Archivo afectado
- `src/components/almacen/SemanaActualPanel.tsx`
