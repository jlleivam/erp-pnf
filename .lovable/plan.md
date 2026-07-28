## Objetivo
Evitar que el "Final" (inv_inicial + recibido − utilizado) sea negativo en el almacén de obra.

## Cambios

**Frontend — `src/components/almacen/SemanaActualPanel.tsx` (`MovRow`)**
- En el `onBlur` del input `utilizado`: si `n > inv_inicial + recibido`, mostrar `toast` de error ("El utilizado no puede superar el inventario disponible: X"), revertir al valor previo y no llamar `onSave`.
- Mantener el resaltado rojo actual mientras se escribe (feedback visual), pero bloquear el guardado.
- Opcional: `max={inv_inicial + recibido}` en el input.

**Backend — `src/lib/api/almacen.functions.ts` (`actualizarUtilizado`)**
- Traer también `inv_inicial, recibido, insumo:insumos(nombre)` del movimiento.
- Antes del `update`, validar `data.utilizado <= inv_inicial + recibido`; si no, `throw new Error("El utilizado (X) supera el inventario disponible (Y) para {insumo}")`.

Sin cambios de BD ni de otros flujos (recepciones y traslado de saldos ya operan con cantidades no negativas).
