## Diagnóstico

Los paquetes ya enviados al supervisor SÍ están persistidos en BD (los confirmé: 2 paquetes con 4 insumos y 2 OCs en `pendiente_autorizacion` para tu requisición actual). El bug está en la **hidratación del cliente**: `ComparativaTable` marca `hydrated = true` antes de que llegue la query de solicitudes, por lo que las asignaciones quedan vacías y la matriz se ve sin nada.

Detalle: el hook (líneas 168-182) sale temprano cuando `solicitudByProveedor` no tiene al proveedor del paquete (`if (!scId) continue`). En el primer render `solsQ` aún no ha resuelto, así que `solicitudByProveedor` está vacío y la hidratación termina sin cargar nada. El effect que invalida `hydrated` (línea 187-189) solo observa `paquetes.length`, `ocs.length` y `recibidas.length` — si por timing `recibidas.length` ya valía 0 cuando se marcó `hydrated=true`, queda atorado.

Además, las tarjetas "Pedido por proveedor" sí deberían aparecer porque vienen de `paqueteByProveedor` independientemente, pero si tampoco las ves quiero confirmar el síntoma antes de tocar esa zona.

## Plan

### `src/components/requisiciones/ComparativaTable.tsx`

1. **Rehidratación robusta**: cambiar el guard a un `useRef` que rastree la "firma" de los datos servidor (`paquetes.length + ocs.length + recibidas.length + solicitudByProveedor.size`). Mientras no coincida con la última firma hidratada, re-ejecutar la hidratación. Esto cubre el caso en que `solsQ` llega después de `cotQ`.

2. **Hidratación parcial tolerante**: dentro del loop, si `scId` no existe para un proveedor (solicitud aún no cargada), no marcar la hidratación como completa — esperar al próximo render con los datos completos. Solo marcar `hydrated` cuando todos los proveedores con paquete tengan su `solicitudId` resuelto.

3. **Conservar ediciones locales no enviadas**: si el usuario ya tocó un proveedor cuya OC aún no está enviada, no sobrescribir sus asignaciones locales con la versión del servidor (mantener el comportamiento actual de "no pisar trabajo en curso"). Para proveedores con OC en `pendiente_autorizacion`/`autorizada`/`pagada`, siempre cargar lo de BD (no debería editarse).

### Verificación

- Reabrir la requisición REQ-2026-002 y confirmar que las 2 tarjetas (Aceros Alcalde y Macrobodega) reaparecen con sus cantidades.
- Confirmar que la matriz superior muestra las cantidades verdes asignadas en cada celda.
- Que el botón "Reenviar a supervisor" / badge "Pendiente autorización" siga visible.

## Antes de implementar

¿Puedes confirmar qué se ve exactamente al reabrir?
- **A**: la pestaña Comparativa aparece totalmente vacía (ni matriz ni tarjetas "Pedido por proveedor")
- **B**: la matriz arriba se ve, pero las cantidades asignadas (números verdes) no aparecen
- **C**: las tarjetas "Pedido por proveedor" abajo no aparecen aunque la matriz sí

Con eso afino la rama del fix.
