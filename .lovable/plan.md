## Objetivo

En la comparativa de cotizaciones, dejar claro cuánto pidió el residente y cuánto cotizó cada proveedor por insumo, para detectar visualmente cuando un proveedor cotizó menos cantidad de la requerida.

## Cambios

**`src/components/requisiciones/ComparativaTable.tsx`**

1. Extender la `matrix` para guardar también la `cantidad` cotizada por cada proveedor (hoy solo guarda precio + disponible).

2. La columna "Cantidad" pasa a llamarse **"Cant. requerida"** y muestra la cantidad de la requisición + unidad (como ya hace hoy).

3. En cada celda de proveedor, además del precio unitario mostrar la cantidad cotizada justo debajo:
   - Si `cantidad_cotizada === cantidad_requerida` → texto normal en muted.
   - Si `cantidad_cotizada < cantidad_requerida` → resaltar en ámbar (`text-amber-700`) con un texto tipo `Cotizó 8 de 10 pz`, para que sea evidente que el proveedor no tiene todo el volumen.
   - Si `cantidad_cotizada > cantidad_requerida` → mostrar en azul informativo.

4. El total ofertado por proveedor ya usa `cantidad * precio_unitario` del item de la cotización, así que sigue siendo correcto (refleja lo que el proveedor realmente puede surtir).

5. Sin cambios de backend ni de schema: `cotizacion_solicitud_insumos.cantidad` ya existe y ya se está actualizando desde el diálogo de captura.

No se toca `CapturarRespuestaDialog`, `SolicitudesTab`, ni las server functions.
