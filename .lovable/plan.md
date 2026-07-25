## Objetivo

Eliminar el scroll horizontal de la tabla de requisiciones administrativas (`/app/admin/requisiciones`) haciéndola más compacta para que quepa en el viewport actual (~750px).

## Cambios en `src/routes/_authenticated/app.admin.requisiciones.tsx`

1. **Quitar el wrapper `overflow-x-auto`** del `Card` para forzar que la tabla se ajuste al ancho disponible.

2. **Compactar columnas y ocultar en mobile**:
   - `Folio`: acortar visualmente (ej. mostrar solo la parte numérica `2026-001` sin `REQ-`, con tooltip del folio completo).
   - `Obra`: reducir `max-w` a `[110px]` con truncate + tooltip.
   - `Solicitante`: ocultar en pantallas pequeñas (`hidden md:table-cell` en vez de `sm`), o mostrar solo el primer nombre + apellido inicial con tooltip.
   - `Insumos`: ya está oculto en `md` — mantener oculto hasta `lg`.
   - `Fecha más próxima`: acortar encabezado a "Fecha" y usar formato corto (`26 jul`).
   - `Estatus`: usar badge sin texto largo — "En cotización" → "Cotizando" o mantener con `whitespace-normal` en 2 líneas compactas (ya lo hace).
   - `Acción`: mantener botón compacto.

3. **Reducir paddings horizontales** de celdas (`px-2`) y tamaño de fuente donde aplique.

4. **Agregar tooltips** (`TooltipProvider` + `Tooltip`) en Folio, Obra y Solicitante para no perder información al truncar.

## Resultado esperado

La tabla cabe completa en viewport de 752px sin scroll horizontal, manteniendo legibilidad y acceso a la info completa vía tooltip.
