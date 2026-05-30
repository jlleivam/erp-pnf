## Diagnóstico

El error sale al pulsar **"Enviar a supervisor"** aunque la tarjeta muestra líneas y total > 0.

Causa raíz (carrera de estado en `ComparativaTable.tsx`):

1. El click ejecuta, en este orden:
   - `setEnviandoProv(provId)` (re-render)
   - `enviarMut.mutate(provId)` → corre `onMutate` que hace `setOptimisticPendiente(s => s.add(provId))` antes de que se ejecute `mutationFn`.

2. `optimisticPendiente` está en las dependencias de `draftLineasByProveedor` (línea 365) y de `provBloqueado` (línea 183). En cuanto se marca optimista:
   - `provBloqueado(provId)` pasa a `true`.
   - Tanto el bucle A como el B de `draftLineasByProveedor` **omiten** ese proveedor → la entrada desaparece del mapa.
   - `resumenPorProveedor` se recalcula; si todavía no se persistió un paquete (autoguardado debounced 600 ms aún sin completarse), la base de `paqueteByProveedor` tampoco lo contiene y el `entry` queda `undefined`.

3. Cuando `mutationFn` por fin corre, lee de closures actualizados:
   - `draftLineasByProveedor.get(proveedorId)` → `[]`
   - `resumenPorProveedor.get(proveedorId)` → `undefined`
   - `insumos.length === 0` → lanza **"Sin líneas para este proveedor"**.

Esto explica por qué pasa siempre justo al hacer click en una tarjeta con líneas visibles.

## Solución

Romper la dependencia del `mutationFn` con los memos que se invalidan por `optimisticPendiente`: snapshotear las líneas al momento del click y pasarlas como argumento a la mutación.

### Cambios en `src/components/requisiciones/ComparativaTable.tsx`

1. **Cambiar la firma de `enviarMut`** para aceptar el payload completo en lugar de sólo el `proveedorId`:

   ```ts
   enviarMut.mutate({ proveedorId, insumos, paqueteId })
   ```

   - `proveedorId`: el id del proveedor (sigue siendo la clave para `optimisticPendiente`/`setEnviandoProv`).
   - `insumos`: array `LineaPersistida[]` ya calculado con `toPersistedLineas(info.lineas)` (las líneas que el usuario está viendo en la tarjeta).
   - `paqueteId`: `knownPaqueteIdByProveedorRef.current[provId] ?? paqueteByProveedor.get(provId)?.id` calculado al click.

2. **En `mutationFn`**, eliminar el lookup contra `draftLineasByProveedor` / `resumenPorProveedor` y usar directamente `insumos` recibido. Mantener la validación de seguridad (`insumos.length > 0` y todas las líneas con precio > 0).

3. **En el botón** (línea 991) computar el snapshot al momento del click:

   ```tsx
   onClick={() => {
     const insumos = toPersistedLineas(info.lineas);
     const paqueteId = knownPaqueteIdByProveedorRef.current[provId] ?? paqueteByProveedor.get(provId)?.id;
     setEnviandoProv(provId);
     enviarMut.mutate({ proveedorId: provId, insumos, paqueteId });
   }}
   ```

   `info.lineas` es exactamente lo que está pintado en la tarjeta, por lo que el "Sin líneas" sólo puede ocurrir si el botón ya estaba desactivado (`puedeEnviar` lo bloquea).

4. **`onMutate` y `onError`** siguen recibiendo el variable de la mutación; ajustar los tipos para leer `vars.proveedorId` en vez del string directo.

### Validación

- Crear requisición → asignar proveedores en la matriz → esperar a que aparezca "Borrador guardado" (o pulsar igual antes; ya no importa) → "Enviar a supervisor" → la OC debe quedar en `pendiente_autorizacion`.
- Repetir sin esperar al autoguardado (click rápido tras asignar) — debe funcionar también, porque las líneas se toman del render, no del paquete persistido.
- Verificar que tras el envío la tarjeta sigue mostrando el estado "Pendiente de autorización" y que al reabrir la requisición se mantiene.

### Archivos a tocar

- `src/components/requisiciones/ComparativaTable.tsx` (sólo).

Sin cambios de esquema ni de backend.
