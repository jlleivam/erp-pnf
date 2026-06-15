## Cambio

Los términos del subcontrato (anticipo % y fondo de garantía %) se definen al crear el subcontrato y se congelan al autorizar el presupuesto base. Una vez creado, ya no deben poder editarse desde la pestaña "Términos".

## Edición

`src/components/subcontratos/SubcontratoDetalleSheet.tsx` → componente `TerminosTab`:

- Eliminar el botón "Editar términos" y todo el bloque de edición (form con inputs de % y botones Guardar/Cancelar, líneas ~631–688).
- Eliminar el estado `editing`, `anticipoPct`, `fondoPct` y la mutación `updM` que usa `actualizarTerminosSubcontrato`.
- Quitar el import `actualizarTerminosSubcontrato` y la prop `canEdit` (ya no se usa para edición de términos; se mantiene la lógica de "Solicitar pago" que usa `!q.isLoading` — esa sigue intacta usando la misma prop o reemplazándola por una variable local equivalente).

Se conserva todo lo demás de la pestaña: tarjetas de Anticipo y Fondo de garantía con sus montos/saldos, badges de estado del anticipo, diálogo de "Solicitar pago" y botón de "Cancelar solicitud".

## Notas

- No se elimina la server function `actualizarTerminosSubcontrato` ni la migración relacionada — sólo se deja de exponer desde la UI. Si prefieres que también borre la server function, dímelo y lo incluyo.
- No se tocan: creación de subcontrato (`NuevoSubcontratoDialog`), autorización del presupuesto base, cálculos de estimaciones, ni nada de pagos.
