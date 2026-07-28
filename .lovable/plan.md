## Objetivo
Permitir crear/solicitar un insumo directamente desde el diálogo "Nueva solicitud de renta" cuando el equipo no está en el catálogo, replicando el flujo del sheet de requisiciones.

## Cambios

**`src/components/rentas/NuevaRentaDialog.tsx`**
- Agregar botón "Solicitar insumo" al lado del label "Equipo" (link/ghost) que abre un dialog interno.
- Detectar rol director con `useAuth()`/`useRoles()` como se hace en requisiciones (revisar cómo se determina `isDirector` en `NuevaRequisicionSheet.tsx` y replicar).
- Cargar `insumo_categorias` y `insumo_unidades` con `listCategoriasInsumos` / `listUnidadesInsumos` (los mismos que usa el sheet).
- Reutilizar el componente `SolicitarInsumoRapidoDialog`: extraerlo de `NuevaRequisicionSheet.tsx` a `src/components/insumos/SolicitarInsumoRapidoDialog.tsx` (export nombrado) y actualizar el import en el sheet de requisiciones para consumirlo desde ahí (sin cambio de comportamiento). Añadir prop opcional `disponibleRenta?: boolean` que se pase a `solicitarInsumo` para que el nuevo insumo quede marcado como disponible para rentas.
- En el diálogo de renta, pasar `disponibleRenta={true}`. En el sheet de requisiciones no pasarlo (default false), preservando el comportamiento actual.
- `onCreated`: invalidar `["insumos-renta"]` y, si el usuario es director (insumo creado autorizado con `newId`), pre-seleccionarlo en `insumoId`.

Sin cambios de BD ni de otros módulos.
