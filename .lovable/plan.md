# Eliminar el módulo de "Supervisión de requisiciones"

Estoy de acuerdo: esa pantalla duplica lo que el módulo de Requisiciones dentro de cada obra ya hace (revisar, autorizar y rechazar según permisos). Se elimina por completo y el supervisor trabaja desde la obra.

## Qué cambia

- Desaparece la sección "Supervisión > Por autorizar" del menú lateral.
- La ruta `/app/supervisor/requisiciones` deja de existir.
- Las notificaciones de "OC pendiente de autorizar" dejan de apuntar a esa pantalla y llevan directo a las requisiciones de la obra correspondiente.
- No cambia ningún permiso ni ninguna lógica de autorización: el supervisor sigue autorizando desde el módulo de Requisiciones de la obra.

## Detalle técnico

- Borrar `src/routes/_authenticated/app.supervisor.requisiciones.tsx` (el árbol de rutas se regenera solo).
- En `src/components/AppShell.tsx`: quitar el bloque `showSupervisor`, su cálculo en la línea 103 y el import de `ShieldCheck` si queda sin uso.
- En `src/lib/api/cotizaciones.functions.ts`: cambiar el `link` de la notificación `oc_pendiente_autorizacion` a `/app/obras/${oc.obra_id}/requisiciones`.
- Buscar cualquier otra referencia a `/app/supervisor/requisiciones` (por ejemplo notificaciones ya guardadas) y actualizar el enlace generado hacia adelante; las notificaciones históricas quedarán con el enlace viejo, así que conviene además redirigir esa ruta antigua a la lista de obras — se resuelve dejando que caiga en la pantalla de "no encontrado" o, si prefieres, agrego una redirección; por defecto no agrego redirección.
- `src/lib/api/requisiciones.functions.ts` conserva `listRequisicionesAsignadas` porque `app.admin.requisiciones.tsx` lo sigue usando.
