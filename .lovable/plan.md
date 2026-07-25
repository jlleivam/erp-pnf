## Problema

En el `InsumoPicker` (dropdown de selección de insumos dentro de `NuevaRequisicionSheet`), la lista de insumos solo se puede recorrer arrastrando la barra de scroll, no con la rueda del mouse ni trackpad.

## Causa

El `PopoverContent` se renderiza en un portal del DOM, pero los eventos sintéticos de React (incluido `onWheel`) burbujean por el árbol de React hasta el `SheetContent` padre, que tiene `overflow-y-auto` (línea 219). El resultado: al girar la rueda sobre la lista, el evento llega al Sheet y hace scroll del sheet en lugar del `CommandList`.

Al usar la barra de scroll directamente se manipula el `scrollTop` del `CommandList` sin generar evento wheel, por eso ese camino sí funciona.

## Solución

En `src/components/requisiciones/NuevaRequisicionSheet.tsx`, dentro del `InsumoPicker`, detener la propagación del evento wheel dentro del `PopoverContent` para que el Sheet no lo intercepte, permitiendo que el scroll nativo del `CommandList` (que ya tiene `max-h-64` + overflow) opere normalmente.

Cambio puntual: agregar `onWheel={(e) => e.stopPropagation()}` al `PopoverContent` del `InsumoPicker` (línea 552). No se toca lógica de negocio ni estilos visibles.

## Verificación

Abrir "Nueva requisición" → desplegar el selector de insumos → confirmar que la rueda del mouse y el gesto de scroll del trackpad recorren la lista de insumos sin mover el sheet.
