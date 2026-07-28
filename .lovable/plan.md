## Problema

La RLS de `role_permissions` sólo permite **SELECT al Director**. Cuando un residente (o cualquier no-director) carga la app:

- `listRolePermissions` corre como ese usuario y devuelve `[]` (RLS filtra todo).
- `usePermisos` cae al catálogo por defecto → residente NO tiene `obras.crear` por default → botón oculto.
- El mismo problema afecta al enforcement server-side (`requirePermission` en `src/lib/permisos/require.ts`), que también leería vacío y denegaría aun si la UI lo mostrara.

Verificado en DB: el override `residente → obras.crear = true` sí está guardado.

## Solución

Permitir a todos los miembros autenticados de la empresa **leer** `role_permissions` (los overrides no son sensibles: son configuración de UI/enforcement compartida). Mantener INSERT/UPDATE/DELETE sólo para Director.

### Cambios

1. **Migración SQL**: nueva policy SELECT en `public.role_permissions`
   - `USING (company_id = current_company_id())` (o el helper equivalente que ya usan otras tablas de la empresa), para role `authenticated`.
   - Mantener las 4 políticas existentes de Director tal cual.

Con eso, `usePermisos` recibe los overrides reales, el residente ve el botón "Nueva obra", y `requirePermission` autoriza la acción en el servidor.

No se requieren cambios en cliente ni en los server functions.
