## Plan: Bloquear insumos ya seleccionados en el dropdown

### Problema
Actualmente el usuario puede agregar el mismo insumo dos veces en bloques distintos de una misma requisición. Se decidió que esto no debe permitirse.

### Solución
Desabilitar visualmente los insumos que ya fueron seleccionados en otro bloque dentro del mismo `Command` del `InsumoPicker`.

### Cambios

1. **`NuevaRequisicionSheet.tsx`** — Línea 134-139 (llamada a `InsumoPicker`):
   - Agregar una nueva prop `disabledIds` que pase los `insumo_id` de los **otros bloques** (todos excepto el actual `i`).
   - Derivado: `const usedIds = bloques.filter((_, idx) => idx !== i).map((b) => b.insumo_id).filter(Boolean)`.

2. **`InsumoPicker`** — Líneas 255-265 (props) y 326-353 (render de items):
   - Agregar `disabledIds?: string[]` a las props.
   - En el `.map` de `filtered.map((ins) => ...)`:
     - Calcular `const isDisabled = disabledIds?.includes(ins.id) ?? false`.
     - Agregar `disabled={isDisabled}` al `CommandItem`.
     - Aplicar estilos de deshabilitado: `opacity-50 cursor-not-allowed` cuando `isDisabled`.
     - Evitar que el `onSelect` ejecute `onChange` cuando está deshabilitado (el prop `disabled` de `CommandItem` debería manejarlo, pero validar).
     - (Opcional pero recomendado) Mostrar un pequeño badge/texto tipo "Ya agregado" al lado del nombre del insumo deshabilitado para claridad.

### Resultado esperado
- Al abrir el picker de un bloque nuevo o existente, los insumos ya elegidos en otros bloques aparecerán atenuados y no serán seleccionables.
- La UX es clara: el usuario ve que el insumo existe, pero sabe que ya lo usó.

### No incluido
- No se valida en el backend (por ahora); la UI es la primera línea de defensa.
- No se impide duplicados entre requisiciones distintas, solo dentro de una misma.