## Objetivo
Hacer que al enviar una tarjeta a supervisor:
- solo se bloquee esa tarjeta,
- cambie de inmediato a `Pendiente de autorización`,
- y no afecte los botones de las demás tarjetas.

## Plan
1. **Aislar el estado de envío por tarjeta**
   - En `ComparativaTable.tsx`, reemplazar la dependencia visual de `enviarMut.isPending` global por un estado local asociado al `proveedorId`/tarjeta en envío.
   - Así, solo la tarjeta que se está enviando deshabilitará sus acciones mientras termina la mutación.

2. **Reflejar el estado pendiente inmediatamente en UI**
   - Agregar un estado local optimista por proveedor para marcar temporalmente la tarjeta como `pendiente_autorizacion` apenas se haga click en `Enviar a supervisor`.
   - Usar ese estado optimista para mostrar el botón deshabilitado `Pendiente de autorización` incluso antes de que termine el refetch.

3. **Mantener sincronía con datos reales del backend**
   - Cuando la mutación termine correctamente, invalidar queries como ya se hace y dejar que el estado real de `ocs` reemplace el optimista.
   - Si falla, limpiar el estado optimista para que la tarjeta vuelva a su estado anterior y no quede bloqueada incorrectamente.

4. **Ajustar condiciones de render de acciones**
   - Hacer que el cálculo de `estatus`, `bloqueado` y `puedeEnviar` use primero el estado optimista de la tarjeta y luego el estado real de la OC.
   - Confirmar que las otras tarjetas sigan operables mientras una sola está en proceso.

## Archivos a tocar
- `src/components/requisiciones/ComparativaTable.tsx`

## Detalle técnico
- El problema actual viene de que `enviarMut.isPending` es compartido por toda la instancia del componente, por eso las 3 tarjetas se deshabilitan al mismo tiempo.
- El cambio será solo de frontend/estado de presentación; no hace falta modificar funciones del backend porque `enviarOCASupervisor` ya cambia el estatus correctamente.