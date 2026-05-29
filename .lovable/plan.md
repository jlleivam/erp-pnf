Modificar el diálogo "Capturar cotización" y la query que lo alimenta:

**1. `src/components/requisiciones/CapturarRespuestaDialog.tsx`**
- Quitar la columna "Disp." (header, celda con `<Switch>`) y la importación de `Switch`.
- Mantener `disponible` en el state derivándolo automáticamente: `disponible = precio_unitario > 0` al enviar la mutación. Así no rompemos el backend.
- Hacer editable la columna "Cant." con un `<Input type="number">` similar al de precio.
- Quitar el `disabled={!it.disponible}` del input de precio (ya no hay toggle).

**2. `src/lib/api/solicitudes-cotizacion.functions.ts` — `getSolicitudesRequisicion`**
- Extender el select de `items` para incluir `insumo:insumos(nombre, unidad)` para que aparezca el nombre del insumo en lugar de "—".

**3. `src/lib/api/solicitudes-cotizacion.functions.ts` — `capturarRespuesta`**
- Aceptar `cantidad` opcional en `RespuestaInput` y, si viene, actualizarla también en `cotizacion_solicitud_insumos`. Esto permite que el admin ajuste la cantidad al capturar la respuesta del proveedor.

No se cambia nada del flujo de paquetes/OCs.