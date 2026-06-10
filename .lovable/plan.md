## Problema

`cerrarEstimacionDestajo` actualiza el estatus a `cerrada` pero no envía notificación al supervisor de la obra, por lo que el supervisor no se entera de que hay una estimación esperando su autorización.

## Cambio

En `src/lib/api/destajos.functions.ts`, dentro de `cerrarEstimacionDestajo`, después del `update` exitoso, agregar bloque `try/catch` que:

1. Carga `obra_team` para `d0!.obra_id` con `role = 'supervisor'` para obtener los `user_id` de los supervisores asignados a la obra.
2. Como fallback (por si la obra no tiene supervisor asignado en `obra_team`), también incluye a los `director` de la compañía desde `user_roles` para que el cierre nunca quede sin notificar.
3. Excluye al `userId` que cerró (evita auto-notificar si el residente es además supervisor).
4. Inserta en `notificaciones` (vía `supabaseAdmin`) un registro por usuario con:
   - `tipo: "estimacion_destajo_por_autorizar"`
   - `titulo: "Estimación de destajo por autorizar"`
   - `mensaje`: incluye número de estimación, nombre del destajo, nombre de la obra y monto neto formateado en MXN.
   - `link`: `/app/obras/{obraId}/destajos?destajo={destajoId}`
   - `company_id`, `obra_id` correspondientes.
5. Cualquier error se hace `console.error` sin romper el cierre (patrón existente).

Para esto se carga el nombre de la obra (`obras.nombre`) y del destajo (`obra_destajos.nombre`) — ya tenemos `d0`, solo falta extender el `select` a `nombre` y hacer una lectura ligera de `obras.nombre`.

## Archivos afectados

- `src/lib/api/destajos.functions.ts`
