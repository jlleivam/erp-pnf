## Problema

Al enviar una OC al supervisor, las asignaciones del cuadro comparativo de los **otros proveedores** (con líneas seleccionadas pero no enviadas) se borran. El usuario tiene que volver a capturarlas.

## Causa

En `src/components/requisiciones/ComparativaTable.tsx`:

- `invalidate()` después de enviar refetchea `paquetes`/`ocs`.
- El efecto de las líneas 187-189 hace `setHydrated(false)` cada vez que cambian las longitudes de `paquetes`/`ocs`/`recibidas`.
- El efecto de hidratación (líneas 169-182) reconstruye `asignaciones` **solo** desde `paqueteByProveedor` (paquetes persistidos). Reemplaza el estado completo con `setAsignaciones(next)`.
- Las asignaciones en curso de otros proveedores (que aún no tienen paquete guardado) no están en `paqueteByProveedor`, así que se pierden.

## Cambio

Reescribir la lógica de hidratación en `ComparativaTable.tsx` para que sea un **merge**, no un reemplazo:

1. Eliminar el efecto que hace `setHydrated(false)` al cambiar longitudes (líneas 187-189) y la bandera `hydrated` asociada.
2. Sustituir el efecto de hidratación por uno que se ejecute cada vez que cambien `paqueteByProveedor` o `solicitudByProveedor`, con esta lógica:
   - Construir un set de `solicitudId`s que pertenecen a proveedores con paquete persistido.
   - Para cada insumo:
     - Conservar las asignaciones del estado actual cuyo `proveedorId` (solicitudId) **NO** corresponda a un proveedor con paquete persistido (estas son ediciones en curso de otros proveedores).
     - Agregar las asignaciones derivadas de los paquetes persistidos (fuente de verdad para proveedores ya guardados/bloqueados).
   - Hacer `setAsignaciones` solo si el resultado difiere del actual (comparación superficial) para no causar loops.

Esto mantiene intactas las selecciones en curso de proveedores que aún no se han enviado, mientras sigue rehidratando correctamente al reabrir el sheet (cuando el estado local arranca vacío y todo viene de paquetes persistidos) y al recibir confirmación del paquete recién enviado.

## Resultado esperado

- Selecciono insumos para Proveedor A y Proveedor B en la comparativa.
- Envío la OC de Proveedor A al supervisor → las líneas de A quedan bloqueadas con su tarjeta "Pendiente autorización".
- Las líneas de Proveedor B **siguen marcadas** en la comparativa y su tarjeta "Pedido por proveedor" sigue visible, lista para enviar.
- Al cerrar y reabrir el sheet, sigue funcionando la rehidratación desde paquetes persistidos (comportamiento ya corregido en el cambio anterior).

No se toca backend, esquema, ni otras pestañas.
