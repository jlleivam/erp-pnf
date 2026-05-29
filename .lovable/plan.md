# Cambio de vista funcional por rol

Hoy el selector "Vista: Director / Residente / Administrativo / Supervisor" solo cambia el texto del botón. La propuesta lo convierte en un cambio de contexto real (visual + permisos) **solo en el frontend**, manteniendo el rol real `director` en backend y RLS.

## Comportamiento esperado

1. Al elegir un rol en el selector:
   - Se guarda `assumedRole` en el store (ya existe).
   - Se navega automáticamente a `/app` (dashboard).
2. La UI se renderiza **como si el usuario solo tuviera ese rol**:
   - Menú lateral, botones de crear/editar/importar, módulos administrativos y de configuración, todo se oculta o se deshabilita según el rol asumido.
3. "Director (mi rol)" restaura la vista completa de director y también redirige al dashboard.

## Cambios

### 1. `src/stores/auth.ts`
Agregar un helper central que devuelve los roles "efectivos" para gating de UI:
```ts
export function effectiveRoles(roles, assumed): AppRole[] {
  if (isDirector(roles) && assumed) return [assumed]; // director simula ser SOLO ese rol
  return roles;
}
export function effectiveIsDirector(roles, assumed) {
  return isDirector(roles) && !assumed;
}
```

### 2. `src/components/AppShell.tsx`
- En cada `DropdownMenuItem` del selector: `setAssumedRole(...)` + `navigate({ to: "/app" })`.
- Reemplazar `director` / `roles.includes("administrativo")` por los helpers efectivos para condicionar:
  - "Equipo", "Nueva obra" (solo director real sin rol asumido)
  - Sección "Administración" (director efectivo u `administrativo` efectivo)
- El propio selector de vista sigue mostrándose solo si el usuario es director real (`isDirector(roles)`), independiente del rol asumido, para que pueda volver.

### 3. Páginas y módulos que ya leen `roles` directo
Cambiar a `effectiveRoles(roles, assumedRole)` para que respeten la vista simulada:
- `src/routes/_authenticated/app.index.tsx` (dashboard: botón "Nueva obra", secciones Admin/Config)
- `src/components/requisiciones/RequisicionesModule.tsx` (`puedeCrear`)
- `src/components/insumos/CatalogoInsumosModule.tsx`
- `src/components/clientes/CatalogoClientesModule.tsx` (`canEdit`)
- `src/components/terceros/CatalogoTerceroModule.tsx` (`canEdit`)
- `src/components/trabajadores/CatalogoTrabajadoresModule.tsx` (`canManage`, `canView`)
- `src/routes/_authenticated/app.equipo.tsx`, `app.obras.nueva.tsx`, `app.obras.$obraId.$.tsx` (gating de acceso director)
- `src/components/requisiciones/RequisicionDetalleSheet.tsx`

Para rutas restringidas a director (Equipo, Nueva obra), si el director asume otro rol y entra a la URL, redirigir a `/app` (se sigue permitiendo porque el rol real lo autoriza, pero la simulación debe respetarse a nivel UI/navegación).

## Aclaraciones importantes (no técnicas)

- Esto es una **simulación visual** para que el director vea la app como la vería un Residente / Administrativo / Supervisor. El backend y las políticas de seguridad siguen tratándolo como director, así que si fuerza una URL podrá seguir entrando. Es útil para revisar la experiencia de cada perfil, no para auditar permisos reales.
- Los usuarios que no son director no ven el selector y no se ven afectados.

## Fuera de alcance

- Cambios en `user_roles`, RLS, JWT o server functions.
- Filtrar datos del backend según el rol asumido (las queries siguen viendo todo lo que ve el director).
