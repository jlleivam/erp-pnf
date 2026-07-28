## Plan

1. **Corregir el cambio de rol simulado en el header**
   - En `AppShell`, al ejecutar `switchRole`, invalidar inmediatamente las consultas de permisos (`role_permissions`) y datos dependientes después de actualizar `assumedRole`.
   - Esto hará que `usePermisos()` recalcule `can("obras.crear")` y oculte el botón “Nueva obra” cuando el rol administrativo no tenga el check.

2. **Corregir el cambio de usuario desde el dropdown DEV**
   - Después de impersonar/cambiar usuario, limpiar o invalidar explícitamente las caches relevantes antes de navegar/recargar:
     - `role_permissions`
     - `dev-switchable-users`
     - `obras`
     - pendientes/notificaciones si aplica
   - Mantener el reload actual, pero asegurar que el estado local de roles/permisos no quede usando datos del usuario anterior durante el cambio.

3. **Hacer el hook de permisos sensible al rol efectivo**
   - Ajustar `usePermisos()` para que su cache/resultado dependa también de los roles efectivos actuales.
   - Si cambia `assumedRole`, el permiso se recalcula inmediatamente aunque la consulta de overrides ya esté cacheada.

4. **Verificar puntos donde aparece “Nueva obra”**
   - Confirmar que tanto el botón del dashboard (`/app`) como el item del sidebar/mobile usan `can("obras.crear")` y no un check antiguo de director/admin.

## Resultado esperado

Cuando simules el rol administrativo y ese rol no tenga permiso para `Crear obra`, el botón/link “Nueva obra” desaparecerá de inmediato en el dashboard y navegación, sin tener que cerrar sesión ni refrescar manualmente.