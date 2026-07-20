Agregar una pestaña "Permisos" en Configuración de empresa que muestra una matriz de acciones × roles con checkboxes. Solo persistencia y UI — los checks de acceso reales del sistema no cambian todavía.

## Alcance
- Catálogo de acciones definido en código (source of truth), agrupado por módulo (Obras, Requisiciones, OCs, Caja chica, CxP, Nómina, Contabilidad, etc.).
- Roles en columnas: `director`, `residente`, `auxiliar`, `administrativo`, `supervisor`.
- Columna de `director` siempre marcada y deshabilitada (super admin fijo, no editable).
- Solo lo puede ver/editar el director.

## Base de datos
Nueva tabla `role_permissions`:
- `company_id` (FK companies)
- `role` (app_role, distinto de director)
- `action_key` (text, ej. `caja_chica.aprobar`)
- `allowed` (bool)
- PK compuesta `(company_id, role, action_key)`
- RLS: solo directores de la empresa pueden leer/editar.
- GRANT a `authenticated` y `service_role`.

No se crean filas por default: la UI toma el "default" del catálogo en código cuando no hay override en DB.

## Catálogo de acciones (en código)
`src/lib/permisos/catalogo.ts` — array tipado con:
```
{ key: 'caja_chica.solicitar_reembolso', modulo: 'Caja chica', label: 'Solicitar reembolso', defaults: { residente: true, auxiliar: false, administrativo: false, supervisor: false } }
```
Empezar con ~30-40 acciones cubriendo los módulos actuales (se pueden ampliar después sin migración).

## Backend
`src/lib/api/permisos.functions.ts`:
- `listRolePermissions()` — devuelve overrides existentes del `company_id` del director.
- `setRolePermission({ role, action_key, allowed })` — upsert. Rechaza si role=director o si el caller no es director.

## UI
Nueva pestaña "Permisos" en `src/routes/_authenticated/app.configuracion.tsx`:
- Componente `PermisosTab` con tabla:
  - Filas agrupadas por módulo (colapsables o con separadores).
  - Columnas: Acción · Director (☑ fijo) · Residente · Auxiliar · Administrativo · Supervisor.
  - Checkbox con estado = override en DB si existe, si no el default del catálogo.
  - Cambios se guardan al toggle (mutation optimista) — no depende del botón global "Guardar" del header.
- Banner informativo arriba: "Los permisos configurados aquí aún no se aplican al sistema. Estamos preparando la migración."

## Fuera de alcance (siguiente iteración)
- Hook `useHasPermission(action)` y `hasPermission()` server-side.
- Migración de los checks hardcodeados actuales.
