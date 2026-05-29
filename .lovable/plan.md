## Objetivo
Cuando una tarjeta se envía a supervisor, las filas correspondientes de la tabla comparativa (selector de proveedor y campo de cantidad) deben quedar bloqueadas de inmediato, igual que cuando la OC ya está en estatus `pendiente_autorizacion` o `autorizada`.

## Plan
1. **Extender el bloqueo de proveedor**
   - En `ComparativaTable.tsx`, hacer que `provBloqueado(proveedorId)` también considere el estado optimista `optimisticPendiente` introducido en el cambio anterior.
   - Así, apenas el admin haga click en "Enviar a supervisor", el proveedor se trata como bloqueado en toda la UI sin esperar al refetch.

2. **Aplicar el bloqueo a las filas de la matriz**
   - Como `filaBloqueada`, el `Select` de proveedor, el botón de quitar (`X`), el `Input` de cantidad y el botón "Proveedor" ya se calculan a partir de `provBloqueado`, al ampliar esa función los controles se deshabilitarán automáticamente para todas las asignaciones de ese proveedor.
   - Confirmar visualmente que aparece el ícono `Lock` y el fondo atenuado en las filas afectadas mientras la OC está pendiente.

3. **Comportamiento de las demás tarjetas**
   - Otras tarjetas y filas no relacionadas siguen editables. Solo se bloquean los insumos asignados al proveedor enviado.

## Archivos a tocar
- `src/components/requisiciones/ComparativaTable.tsx`

## Detalle técnico
- Cambio mínimo: `provBloqueado` pasa de basarse solo en `ocByProveedor` a también revisar `optimisticPendiente.has(proveedorId)`.
- No se tocan funciones del backend; ya validan que un paquete con OC enviada no pueda editarse.