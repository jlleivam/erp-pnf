## Problema
Al enviar la tarjeta de Macrobodega a autorización, el selector de proveedor y el input de cantidad en la columna "Asignar a" de la tabla comparativa siguen editables. Solo se bloquean cuando el refetch del backend trae la OC con estatus `pendiente_autorizacion`, lo que tarda 1–3 segundos.

## Causa
En `ComparativaTable.tsx`, `enviarMut` solo agrega el proveedor a `optimisticPendiente` dentro de `onSuccess`, no al disparar la mutación. Entre el click y el `onSuccess` no hay marca optimista, así que `provBloqueado(provId)` devuelve `false` y todos los controles siguen activos.

## Plan
1. **Mover la marca optimista a `onMutate`**
   - En `enviarMut`, agregar `onMutate: (proveedorId) => setOptimisticPendiente(...add(proveedorId))` para que el bloqueo se aplique en el mismo render del click.
   - Quitar el `setOptimisticPendiente` de `onSuccess` (ya no es necesario; el efecto existente lo limpia cuando la OC real llega con estatus posterior).

2. **Revertir en error**
   - En `onError`, quitar el `proveedorId` de `optimisticPendiente` además del `setEnviandoProv(null)` actual, para que si el envío falla los controles vuelvan a ser editables.
   - Para esto necesitamos que `onError` reciba el `proveedorId`; usar la firma `onError: (_e, proveedorId) => { ... }` que TanStack Query pasa como segundo argumento.

3. **Confirmar el efecto en la tabla**
   - Como `provBloqueado` ya consulta `optimisticPendiente`, y `filaBloqueada` / `bloqueado` de cada asignación se derivan de él, al pulsar el botón los `Select` de proveedor, el `Input` de cantidad, el botón `X` y el botón "Proveedor" de las filas que apuntan a Macrobodega quedarán deshabilitados de inmediato, con el icono `Lock` y el fondo atenuado.

## Archivos a tocar
- `src/components/requisiciones/ComparativaTable.tsx`

## Notas
- No se cambia ningún server function ni lógica de backend.
- El comportamiento de las demás tarjetas (Aceros Alcalde, Construalcalde) no se ve afectado: solo se bloquea el proveedor enviado.
