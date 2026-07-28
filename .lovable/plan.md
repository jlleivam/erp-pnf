## Objetivo
Replicar el comportamiento de "Agregar renglón" del presupuesto de obra en los presupuestos base de **Destajos** y **Subcontratos**: al insertar, el nuevo renglón se coloca justo debajo del renglón activo (no al final), y el renglón activo se resalta visualmente.

## Cambios

### `src/components/destajos/CapturaDestajoSheet.tsx` y `src/components/subcontratos/CapturaSubcontratoSheet.tsx`

Ambos archivos comparten la misma estructura, se aplica idéntico refactor:

1. **Estado activo:** añadir `const [activeRowId, setActiveRowId] = useState<string | null>(null);` y resetearlo a `null` al hidratar `rows` desde `data.renglones`.
2. **`addRow`:** insertar el nuevo renglón después de `activeRowId` (fallback: al final si no hay activo). Marcar el nuevo renglón como activo.
3. **`removeRow`:** si se elimina el renglón activo, mover `activeRowId` al vecino anterior o siguiente.
4. **`handleRowActivate`:** activar en `onFocus` y `onMouseDown` de cada `<tr>`.
5. **Resaltado visual del `<tr>`:** aplicar la misma cascada de clases del presupuesto (error > padre > activo > hover) incluyendo `ring-1 ring-inset ring-primary/20` cuando `esActivo`.

Sin cambios en la lógica de cálculo, guardado, validaciones ni columnas. Sin cambios en backend.

## Fuera de alcance
- Órdenes de cambio (`CapturaOrdenCambioSheet.tsx`) — no fue mencionado.
- Otros comportamientos del sheet del presupuesto (headers sticky, imports, etc.) que ya existen o no en estos sheets.