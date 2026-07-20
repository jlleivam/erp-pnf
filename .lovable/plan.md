## Menú del usuario en la esquina superior derecha

Convertir el dropdown del avatar/nombre en un menú con tres accesos:

1. **Configuración de empresa** — link a `/app/configuracion` (visible solo para director, igual que hoy en la sidebar).
2. **Mi cuenta** — link a una nueva ruta `/app/mi-cuenta` (visible para todos los usuarios autenticados).
3. **Cerrar sesión** — ya existe.

### Nueva página `/app/mi-cuenta`

Página mínima con dos secciones:

- **Perfil**: editar `nombre_completo` (email en solo lectura).
- **Seguridad**: cambiar contraseña (nueva + confirmación).

### Cambios de archivos

- `src/components/AppShell.tsx`: agregar items "Configuración de empresa" (condicional a `director`) y "Mi cuenta" en el `DropdownMenuContent` del avatar, con iconos `Building2` / `User`, antes del separator y "Cerrar sesión".
- `src/routes/_authenticated/app.mi-cuenta.tsx`: nueva ruta con la página.
- `src/lib/api/auth.functions.ts`: agregar `updateMyProfile({ nombre_completo })` (server fn con `requireSupabaseAuth`) que actualiza `profiles`. El cambio de contraseña se hace client-side con `supabase.auth.updateUser({ password })`.
- Tras guardar el nombre, refrescar el store de auth (`useAuthStore`) para que el header muestre el nombre nuevo.
