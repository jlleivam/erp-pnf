# Switcher de usuario (modo desarrollo)

Reemplazo del botón actual "Vista: {rol}" en el header por un selector que cambia la **sesión real** de Supabase al usuario elegido — únicamente para acelerar el desarrollo y probar cada perfil.

## Comportamiento

- Botón siempre visible en el header (junto a la campana de notificaciones), con etiqueta `Dev: {nombre del usuario activo}`.
- Al abrir, lista **todos los profiles de la empresa actual**, ordenados por nombre, con su rol principal entre paréntesis (Director / Residente / Administrativo / Supervisor / Auxiliar).
- Al elegir un usuario: se cierra la sesión actual, se inicia sesión como ese usuario, se invalida el caché de queries y se redirige a `/app`.
- El usuario actualmente activo aparece marcado.

## Cómo se cambia de sesión sin pedir contraseña

Se usa un server function con `supabaseAdmin` (service role) que genera un **magic link** para el usuario seleccionado y devuelve el `token_hash`. El cliente llama `supabase.auth.verifyOtp({ type: 'magiclink', token_hash })`, lo que crea una sesión válida real — sin necesidad de almacenar contraseñas de prueba.

## Detalles técnicos

**Nuevo:** `src/lib/dev-switch.functions.ts`
- `listSwitchableUsers` (`createServerFn`, `requireSupabaseAuth`): consulta `profiles` filtrando por `company_id = current_company_id()` y hace join con `user_roles` para devolver `{ id, nombre_completo, email, roles[] }`. Ordena por nombre.
- `impersonateUser` (`createServerFn`, `requireSupabaseAuth`, input `{ userId }`): carga `supabaseAdmin` dentro del handler (`await import(...)`), obtiene el email del profile destino y llama `supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email })`. Devuelve `{ token_hash, email }`.

**Editado:** `src/components/AppShell.tsx`
- Quitar el bloque `realDirector && <DropdownMenu>...switchRole...</DropdownMenu>` (líneas 237–265).
- Añadir un nuevo `<DropdownMenu>` "Dev user switcher":
  - Trigger: `Button variant="outline"` con texto `Dev: {profile.nombre_completo}` + `ChevronDown`.
  - Contenido: `useQuery(['dev-users'], listSwitchableUsers)` → renderiza items con `nombre_completo` y badge de roles; el item del usuario actual deshabilitado.
  - onClick: llama `impersonateUser({ userId })` → `await supabase.auth.signOut()` → `await supabase.auth.verifyOtp({ type: 'magiclink', token_hash })` → `queryClient.clear()` → `navigate({ to: '/app', replace: true })`.
- Mantener el código de `assumedRole`/`switchRole` en `auth` store por si lo necesitas después, pero ya no se usa en UI (puedo borrarlo si prefieres).

**Sin cambios:** schema de BD, RLS, edge functions, otros componentes.

## Riesgos / notas

- Cualquiera autenticado podrá impersonar a otros usuarios de su empresa mientras este switcher esté activo. Es intencional para desarrollo. Cuando quieras quitarlo en producción, basta con envolver el bloque en `import.meta.env.DEV` o eliminarlo.
- El magic link generado por admin **no envía email** (solo devolvemos el `token_hash` al cliente para `verifyOtp`).

¿Procedo con la implementación?
