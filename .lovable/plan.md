## Objetivo

Aplicar los permisos de `role_permissions` como fuente de verdad para las 4 acciones del módulo **Obras**: `obras.crear`, `obras.editar`, `obras.eliminar`, `obras.asignar_team`. Quien tenga el check en la matriz puede realizar la acción; Director siempre bypasea. Sin cambios de esquema ni de RLS en esta iteración.

## Alcance (solo Obras)

| Acción | Default catálogo hoy | Comportamiento hoy | Después del cambio |
|---|---|---|---|
| `obras.crear` | Administrativo | Solo Director (UI + RLS) | Quien tenga el check (default: Administrativo) |
| `obras.editar` | Administrativo | Solo Director (UI + server + RLS) | Quien tenga el check |
| `obras.eliminar` | Nadie | No existe | Se implementa con soft-delete opcional (ver más abajo) o se deja pendiente |
| `obras.asignar_team` | Administrativo | Solo Director | Quien tenga el check |

**Nota sobre `obras.eliminar`**: hoy no existe la acción en ningún lado. Propongo dejarla **fuera de este cambio** (queda en el catálogo pero sin implementación) y decidirla en otra iteración. Confírmame si prefieres implementarla ahora.

## Piezas nuevas

### 1. Helper compartido `src/lib/permisos/check.ts`
- `hasPermission(actionKey, roles[], overridesMap): boolean`.
- Director → `true` sin consultar overrides.
- Combina `CATALOGO_ACCIONES[key].defaults[role]` con overrides de `role_permissions`.
- Unión sobre múltiples roles del usuario.

### 2. Hook cliente `src/hooks/usePermisos.ts`
- Una sola query React Query (`["role_permissions"]`) reutilizando `listRolePermissions`.
- Expone `can(actionKey)` que evalúa contra `useEffectiveRoles()` (respeta rol asumido del director).
- Expone `isDirector` para casos que necesiten bypass explícito.

### 3. Middleware/helper servidor `src/lib/permisos/server.ts`
- `requirePermission(context, actionKey)`: lee `user_roles` reales del usuario (ignora rol asumido) + `role_permissions` de la empresa, evalúa contra el catálogo, lanza si no tiene permiso.
- Se invoca al inicio del `.handler()` de cada server function protegida.

### 4. RLS: relajar policies de Obras
Como el nuevo enforcement vive en la app, las policies actuales `Director manages obras / obra_team / obra_comisiones` bloquearían al Administrativo aunque tenga el check. Cambio necesario en `supabase/migrations/…`:
- Reemplazar `is_director_of(company_id)` por una condición más laxa: `company_id = current_company_id()` para INSERT/UPDATE/DELETE, dejando el enforcement fino en `requirePermission` server-side.
- Esta es la única migración de la iteración; RLS pasa de "director-only" a "same-company", y la app decide quién puede.

## Cambios por archivo

### Catálogo
- `src/lib/permisos/catalogo.ts`: exportar `ACTION_KEYS` como constantes tipadas para evitar typos (ej. `ACTION_KEYS.OBRAS_CREAR`).

### Server functions (`src/lib/api/obras.functions.ts`)
- `crearObra`: agregar `await requirePermission(context, "obras.crear")` al inicio del handler.
- `getObraConfiguracion`, `actualizarObra`, `actualizarObraTeam`, `actualizarObraComisiones`: reemplazar `assertDirectorDeObra` por `requirePermission(context, "obras.editar")` (para get/actualizar) y `"obras.asignar_team"` (para team/comisiones). Borrar el helper `assertDirectorDeObra`.

### UI
- `src/routes/_authenticated/app.obras.nueva.tsx`: reemplazar `useEffectiveIsDirector()` (líneas 50, 129) por `usePermisos().can("obras.crear")`. Mensaje de bloqueo genérico: "No tienes permiso para crear obras".
- `src/routes/_authenticated/app.obras.$obraId.configuracion.tsx`: 
  - Tab "Datos generales": mostrar solo si `can("obras.editar")`.
  - Tab "Equipo": mostrar solo si `can("obras.asignar_team")`.
  - Reemplazar `useEffectiveIsDirector()` (línea 54-69) por evaluación por tab.
  - Si el usuario no tiene ninguno de los dos permisos, redirigir a `/app/obras/$obraId` como hoy.
- **Botón/entrada "Nueva obra"** en la lista de obras (`app.obras.index` o donde viva el CTA): ocultar cuando `!can("obras.crear")`.

### `PermisosTab.tsx`
- Quitar el `Alert` que dice "aún no se aplican al sistema" (líneas 69-75) — ahora sí aplican, al menos para Obras. Reemplazar por una nota más suave: "Los cambios afectan a toda la empresa en los módulos ya migrados".
- Al mutar exitosamente, invalidar también `["role_permissions"]` para que `usePermisos` se refresque en toda la app.

## Detalles de comportamiento

- **Director asumiendo otro rol**: la UI se comporta como el rol asumido (lo que ya hace `useEffectiveRoles`). Si un director simula "residente" y "residente" no tiene `obras.editar`, no verá el botón. En servidor sigue siendo director real → puede.
- **Un usuario con varios roles**: se permite si CUALQUIERA de sus roles tiene el check (unión). Sin cambios de UI necesarios.
- **Empresa recién creada sin overrides**: se comporta según los defaults del catálogo. Esto **sí es un cambio de comportamiento** (Administrativo ahora podrá crear/editar obras por default). Es lo pedido explícitamente.
- **Sin cambios de notificaciones** en esta iteración (Obras hoy no emite ninguna).

## Verificación

1. Login como Administrativo → verificar que aparece "Nueva obra", puede crear, editar y asignar equipo.
2. Login como Residente → verificar que NO ve esas acciones.
3. Administrativo, desmarcar `obras.crear` desde la matriz → refresh, verificar que desaparece el CTA de inmediato (React Query invalidación).
4. Intentar invocar `crearObra` directamente sin permiso → debe fallar con error "No autorizado".
5. Director → debe poder todo, con o sin overrides.

## Riesgos

- **Cambio de RLS**: relajar de "director-only" a "same-company" en `obras`, `obra_team`, `obra_comisiones`. Riesgo controlado porque el enforcement fino se mueve a `requirePermission` en cada handler y todos los handlers lo tendrán antes de tocar la tabla. Si alguna vez un handler olvida `requirePermission`, la protección sería solo de company (no de rol). Mitigación: convención estricta + revisión, y a futuro podríamos añadir un lint o tests.
- **Cambio de default para Administrativo**: si algún usuario no debe poder crear/editar obras, el director tendrá que desmarcarlo explícitamente. Ok según lo pedido.

## Fuera de alcance

- Otros módulos (Requisiciones, OC, Caja chica, etc.) — se harán uno por uno en iteraciones separadas siguiendo este mismo patrón.
- `obras.eliminar` — pendiente de confirmar si se implementa ahora.
- Notificaciones por rol.
- Override de permisos por obra.
