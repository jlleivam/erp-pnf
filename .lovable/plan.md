## Problema
1. Al pulsar varias veces "Enviar a supervisor" para el mismo proveedor, el frontend creó **paquetes duplicados** (15 paquetes para 3 proveedores en la requisición REQ-2026-001), porque cada nuevo envío reusó un `paqueteId` que ya tenía OC `pendiente_autorizacion` y, al fallar el reuso, terminó insertando uno nuevo.
2. Al volver a la pestaña Comparativa, la hidratación recorre **todos** los paquetes y suma asignaciones repetidas; `paqueteByProveedor` y `ocByProveedor` se quedan con el **último** paquete/OC iterado, no con el que corresponde a la tarjeta visible. Resultado: la matriz aparece vacía / inconsistente y las tarjetas no reflejan lo asignado originalmente.

## Causa
- `enviarMut` en `ComparativaTable.tsx` siempre llama a `guardarPaquete` con el `paqueteId` que devuelve `paqueteByProveedor.get(proveedorId)`. Cuando ese paquete ya tiene una OC enviada, `guardarPaquete` lanza error; pero antes de que aparezca, el usuario re-intenta y como `paqueteByProveedor` ahora apunta al paquete recién creado (que sí es editable), el flujo crea otro y otro.
- `paqueteByProveedor` y `ocByProveedor` se construyen con un `for + map.set` que sobrescribe — pierden información cuando hay más de un paquete por proveedor.
- `useEffect` de hidratación itera todos los paquetes y `push`-ea cada item, generando entradas duplicadas en `asignaciones`.

## Plan

### 1. Frontend — elegir paquete canónico por proveedor (`ComparativaTable.tsx`)
- Reemplazar `paqueteByProveedor` y `ocByProveedor` por mapas que apliquen una **prioridad de selección**:
  1. paquete cuya OC esté en `pendiente_autorizacion` / `autorizada` / `pagada` (el "enviado");
  2. en su defecto, paquete con OC `borrador` o `rechazada`;
  3. en su defecto, paquete sin OC.
- Reescribir la hidratación para usar **ese mismo paquete canónico** (no todos), evitando duplicación de líneas.
- En `enviarMut`:
  - Si el paquete canónico está bloqueado (OC enviada), abortar con `toast` (`provBloqueado` ya lo deshabilita; añadimos guard defensivo).
  - Pasar `paqueteId` del canónico cuando esté en `borrador`/`rechazada`; pasar `undefined` solo si **no existe** ningún paquete reusable para ese proveedor.

### 2. Backend — proteger contra duplicados (`cotizaciones.functions.ts`)
- En `guardarPaquete`, cuando `paqueteId` viene `undefined` pero ya existe un paquete del mismo `requisicion_id + proveedor_id` cuya OC no está enviada (sin OC o en `borrador`/`rechazada`), **reutilizarlo** en vez de crear uno nuevo.
- Si todos los paquetes existentes para ese proveedor tienen OC enviada, devolver error claro ("Ya hay una OC pendiente/autorizada para este proveedor") en vez de insertar.

### 3. Limpieza de datos (migración manual)
- Crear una migración SQL que para la requisición `08e4ea1f-…` (y, vía script idempotente, cualquier otra que tenga duplicados):
  - conserve el paquete con OC enviada más reciente por proveedor;
  - elimine los paquetes huérfanos sin OC (y sus `cotizacion_paquete_insumos`) que sean duplicados del mismo proveedor.
- No se borran OCs en pendiente; solo paquetes sin OC asociada que dupliquen a otros del mismo proveedor.

### 4. Verificación
- Tras aplicar la migración, recargar Comparativa: deben verse 3 tarjetas (Macrobodega, Aceros Alcalde, Construalcalde) en estado `pendiente_autorizacion` y la matriz con las asignaciones bloqueadas.
- Hacer un envío adicional simulado y confirmar que **no** se crea un paquete nuevo (chequeo en BD).

## Archivos a tocar
- `src/components/requisiciones/ComparativaTable.tsx`
- `src/lib/api/cotizaciones.functions.ts`
- `supabase/migrations/<timestamp>_cleanup_paquetes_duplicados.sql`

## Notas
- No se cambia ninguna política RLS ni esquema; solo lógica de aplicación y un cleanup puntual.
- El cambio en `guardarPaquete` es retro-compatible con flujos que ya envían un `paqueteId` válido.
