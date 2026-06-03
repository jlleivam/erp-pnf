## Problema

Al revisar el reembolso, los gastos ya están en estado **"aprobado"** (porque `solicitarReembolso` los pone como `solicitado` y `cerrarRevision` los pasa a `aprobado`, pero al revisar individualmente se pueden re-marcar). En el video se ve que SÍ se ejecuta la acción —el reembolso pasa a "En revisión"—, pero:

1. **No hay toast de éxito** en `revisarM.onSuccess` (sólo se invalida la query), por lo que no hay confirmación visual.
2. Si el gasto ya está `aprobado`, volver a aprobar no cambia su badge: no hay feedback de que pasó algo.
3. Los botones no se deshabilitan mientras `revisarM.isPending`.

## Solución (UI en `RevisarReembolsoSheet.tsx`)

1. **Toast de confirmación**: en `revisarM.onSuccess`, mostrar `toast.success("Gasto aprobado")` o `"Gasto rechazado"` según la decisión. Usar `onMutate`/variables para conocer la decisión.
2. **Estado pendiente por gasto**: rastrear qué gasto está mutando (`revisarM.variables?.data.gastoId`) y deshabilitar los botones Aprobar/Rechazar de esa fila mientras `isPending`, mostrando un texto tipo "Guardando…".
3. **Ocultar botón redundante**: si `g.estatus === "aprobado"`, ocultar el botón "Aprobar" (dejar sólo "Rechazar"); si `g.estatus === "rechazado"`, ocultar "Rechazar" (dejar sólo "Aprobar"). Así el click siempre representa un cambio real de estado y el usuario ve la actualización del badge.
4. **Validar motivo al rechazar**: requerir que el motivo no esté vacío al rechazar (toast.error si está vacío), consistente con "Rechazar todo".

## Archivos

- `src/components/caja-chica/RevisarReembolsoSheet.tsx` — única modificación, todo en frontend.

## Fuera de alcance

- No se toca el backend (`revisarGastoReembolso`) — ya funciona correctamente.
- No se cambia la lógica de transición de estados de gastos/reembolsos.
