## Contexto

El `DevUserSwitcher` (botón "DEV" del header) YA hace un cambio real de sesión: genera un magic-link con `supabaseAdmin.auth.admin.generateLink`, cierra la sesión actual, verifica el OTP como el nuevo usuario, limpia el cache y recarga. A partir de ese momento la app corre 100% como ese usuario:

- `auth.uid()` cambia (RLS aplica)
- `user_roles` se lee para el nuevo usuario (verificado: Pedro tiene `administrativo`)
- `usePermisos` evalúa contra los roles reales y los overrides guardados (verificado: `obras.crear=false` para administrativo hace que el botón desaparezca)

Por lo tanto no hay que agregar lógica de permisos al switcher — ya funciona. Solo hay que **quitar** el submenú "Actuar como" que agregamos en el turno anterior, porque duplica esa función de manera más limitada (solo Director, sin cambiar `auth.uid()` — así que RLS no se prueba).

## Cambios

**`src/components/AppShell.tsx`**
- Eliminar del menú del avatar el bloque `DropdownMenuSub` "Actuar como" (agregado en el turno anterior).
- Eliminar el badge "como {rol}" junto al nombre en el header.
- Eliminar imports que quedan sin uso: `DropdownMenuSub`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent`, `DropdownMenuPortal`, `Badge`, `UserCog`, `Check`.
- Eliminar el helper `switchRole` local y `setAssumedRole` si ya no se usa.
- Mantener `useRealIsDirector` porque otros gates lo pueden necesitar; si tras la limpieza no se usa, quitarlo también.

**Opcional — decidir en build**  
Simplificar `src/stores/auth.ts` retirando `assumedRole`, `setAssumedRole` y las funciones `effectiveRole/effectiveRoles/effectiveIsDirector` que dependen de él, sustituyendo sus consumidores por `roles`/`isDirector` directamente. Aporta claridad pero toca varios archivos; lo dejo como paso opcional a confirmar si aparecen usos residuales.

## Cómo se prueba después

1. Desde el header abrir "DEV" → elegir un usuario con rol Residente/Administrativo/etc.
2. La app recarga como ese usuario. El botón "Nueva obra" (u otros gates de permisos) aparecen/desaparecen según el rol real del usuario elegido y los overrides configurados en Permisos.
3. Verificado en la sesión actual: Pedro (`administrativo`) + override `obras.crear=false` → botón oculto ✅.
