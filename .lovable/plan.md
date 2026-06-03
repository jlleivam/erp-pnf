## Objetivo

Que cada módulo de una obra (presupuesto, requisiciones, estimaciones, etc.) muestre un botón para regresar al dashboard de esa obra (`/app/obras/$obraId`).

## Enfoque

En lugar de editar cada uno de los ~14 módulos individualmente, añadir el botón **una sola vez** en el wrapper común `src/routes/_authenticated/app.obras.$obraId.$.tsx`, justo arriba del módulo renderizado. Así aparece automáticamente en todos.

## Cambios

**`src/routes/_authenticated/app.obras.$obraId.$.tsx`**
- Envolver el módulo renderizado en un `<div>` con un header ligero arriba.
- El header contiene un `<Link to="/app/obras/$obraId" params={{ obraId }}>` con icono `ArrowLeft` de lucide-react y texto "Volver a la obra" (compacto, tipo botón ghost).
- Se aplica a todos los slugs (presupuesto, requisiciones, almacén, estimaciones, nómina, destajos, subcontratos, rentas, gasolinas, caja chica, estado de resultados, tareas, catálogos, y el `ModulePlaceholder` por defecto).

## No se toca

- Los componentes de cada módulo individual quedan intactos.
- `ObraShell.tsx` y la vista de dashboard de obra (`app.obras.$obraId.index.tsx`) no cambian — el botón solo aparece dentro de los sub-módulos, no en el dashboard mismo.
