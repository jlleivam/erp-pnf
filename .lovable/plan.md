## Bug

`Maximum update depth exceeded` en `NuevoDestajoDialog`. El `useEffect` de pre-selección hace `setIdsPrevios(new Set(...))` con una referencia nueva en cada render (rama `!canManage` y también cuando hay nuevos), provocando bucle infinito porque React compara por referencia.

## Arreglo

Archivo: `src/components/destajos/NuevoDestajoDialog.tsx`

1. Reemplazar el `Set` en estado por una `useRef<Set<string> | null>(null)` — los refs no disparan renders, eliminando el ciclo.
2. En el `useEffect`:
   - Primera corrida (ref null): inicializar el ref con los ids actuales y salir.
   - Si `canManage` y hay ids nuevos respecto al ref: pre-seleccionar el primero (solo si no hay `destajistaId` ya elegido) y actualizar el ref.
   - Si `!canManage`: solo actualizar el ref, sin `setState`.
3. Mantener dependencias mínimas: `[trabajadores, canManage]` (sin `idsPrevios` ni `destajistaId` para evitar re-disparos).

Sin cambios de UI ni de lógica adicional.
