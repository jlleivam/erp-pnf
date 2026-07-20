## Objetivo
Cada usuario de la empresa tendrá **exactamente un rol** (regla nueva). El director es siempre director; los demás son residente, auxiliar, administrativo o supervisor.

## Cambios

### 1. Base de datos (migración)
- Agregar índice único parcial en `user_roles(user_id, company_id)` para garantizar un solo rol por usuario dentro de una empresa (Director sigue siendo un rol más; solo puede haber uno).
- No se eliminan filas existentes automáticamente — solo aplica hacia adelante. (Actualmente todos los usuarios tienen un solo rol tras el wipe, así que no hay conflictos.)

### 2. Backend — `src/lib/api/team.functions.ts`
- Cambiar `inviteSchema.roles` y `updateRolesSchema.roles` de `z.array(roleEnum).min(1).max(5)` a un solo campo `role: roleEnum`.
- En `inviteTeamMember`: insertar una única fila en `user_roles`.
- En `updateMemberRoles` (renombrar a `updateMemberRole`): borrar filas previas e insertar una sola.
- Mantener la validación "no puedes quitarte tu rol de Director".

### 3. UI — `src/components/equipo/EquipoModule.tsx`
- Reemplazar los `Checkbox` por un `Select` (o `RadioGroup`) con un único rol.
- `InviteDialog`: `selectedRole` en lugar de `selectedRoles: AppRole[]`. Default: `residente`.
- `EditRolesDialog` (renombrar a `EditRoleDialog`): mismo cambio.
- Tabla: la columna "Roles" muestra un único badge en vez de lista.

### 4. Sin cambios en el resto de la app
- Los checks existentes (`role === 'residente'`, `useEffectiveIsDirector`, etc.) siguen funcionando: iteran sobre el arreglo `roles` que ahora tendrá siempre 1 elemento.
- `getMiRolEnObra` y demás funciones que leen `user_roles` no requieren cambio.

## Notas
- El módulo de Permisos ya trata cada rol independientemente, así que sigue funcionando.
- Onboarding (que asigna rol `director` al crear la empresa) no se toca.
