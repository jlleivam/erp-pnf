## Cambio

En el encabezado del sheet de "Ver presupuesto" (y equivalentes), el monto total (`$0.00`) queda pegado a la "X" de cerrar del sheet.

## Acción

- Añadir padding derecho al header del sheet en `src/components/presupuesto/VerPresupuestoSheet.tsx` (y `VerVigenteSheet.tsx` si aplica el mismo patrón) para que el título + monto no se empalmen con el botón de cerrar del `SheetContent`.
- Concretamente: agregar `pr-10` (o `pr-12`) al contenedor del `SheetHeader` que incluye el título y el monto, dejando espacio para la "X" del sheet.

Sin cambios de lógica ni de estilo visual más allá del espaciado.