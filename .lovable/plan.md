# Unificar Catálogos en /app/catalogos

## Estado actual
- `/app/clientes` es una ruta independiente (`src/routes/_authenticated/app.clientes.tsx`) enlazada en el sidebar principal.
- El catálogo de insumos vive sólo dentro del módulo admin: `/app/admin/catalogos` muestra `CatalogoInsumosModule` vía el catch-all `app.admin.$.tsx`.
- No existe ruta `/app/clientes/$clienteId` (el detalle se abre en un Sheet desde la lista).
- El sidebar tiene un enlace directo a **Clientes** y otro a **Catálogos** dentro de "Administración".

## Nueva estructura de rutas

Crear bajo `src/routes/_authenticated/`:

- `app.catalogos.tsx` — layout con tabs/selector y `<Outlet />`.
- `app.catalogos.index.tsx` — redirige a `/app/catalogos/clientes`.
- `app.catalogos.clientes.tsx` — monta el componente actual de la lista de clientes (extraído de `app.clientes.tsx`).
- `app.catalogos.clientes.$clienteId.tsx` — abre la misma vista de lista con el detalle preseleccionado (compatibilidad con deep-links).
- `app.catalogos.insumos.tsx` — renderiza `<CatalogoInsumosModule />`.
- `app.catalogos.trabajadores.tsx`, `app.catalogos.proveedores.tsx`, `app.catalogos.subcontratistas.tsx` — usan `<ModulePlaceholder />`.

Redirecciones (legacy):

- `app.clientes.tsx` se reemplaza por una ruta que hace `throw redirect({ to: "/app/catalogos/clientes" })` en `beforeLoad`.
- Como no hay ruta `app.clientes.$clienteId.tsx` actualmente, sólo se cubre `/app/clientes`. Si se desea, se agrega además `app.clientes.$clienteId.tsx` que redirige a `/app/catalogos/clientes/$clienteId`.

## Refactor del contenido de clientes

- Extraer el cuerpo del componente de `app.clientes.tsx` a `src/components/clientes/CatalogoClientesModule.tsx` (sin `createFileRoute`, recibe opcionalmente `initialClienteId?: string`).
- `app.catalogos.clientes.tsx` lo monta sin params.
- `app.catalogos.clientes.$clienteId.tsx` lo monta pasando `initialClienteId={params.clienteId}` para abrir el Sheet de detalle automáticamente.

## Layout de Catálogos (`app.catalogos.tsx`)

- Header con título "Catálogos".
- Navegación por sección con las cinco entradas (Clientes, Insumos, Trabajadores, Proveedores, Subcontratistas):
  - **Desktop (≥768px):** tabs horizontales con el mismo estilo del resto (basadas en `Link` de TanStack + `data-status="active"` para resaltar, o el componente `Tabs` de shadcn enlazado al pathname).
  - **Móvil (<768px):** `<Select>` de shadcn con las mismas opciones; al cambiar, `navigate({ to })`.
- Debajo, `<Outlet />` para la sección activa.

La detección de la pestaña activa usa `useRouterState({ select: s => s.location.pathname })` y compara con `startsWith("/app/catalogos/<slug>")`.

## Sidebar (`src/components/AppShell.tsx`)

- Eliminar el `NavItem` directo de **Clientes**.
- Añadir un `NavItem` a **Catálogos** (`/app/catalogos`, icono `BookOpen`) en la sección "Corporativo", activo cuando `pathname.startsWith("/app/catalogos")`.

## Módulo admin (`src/lib/modules.ts` y `app.admin.$.tsx`)

- Quitar la entrada `{ to: "/app/admin/catalogos", label: "Catálogos" }` de `ADMIN_MODULES` para no duplicar acceso.
- En `app.admin.$.tsx`, eliminar la rama `if (slug === "catalogos")` (ya no aplica). Si alguien entra a `/app/admin/catalogos`, mostrar `ModulePlaceholder` por defecto o, mejor, redirigir a `/app/catalogos` desde `beforeLoad` cuando `_splat === "catalogos"`.

## Permisos

- `/app/catalogos` se mantiene bajo el layout `_authenticated`. No se añaden checks de rol nuevos: los permisos por sección (p.ej. Director/Administrativo) ya viven dentro de cada módulo (clientes, insumos, etc.).

## Archivos tocados

Crear:
- `src/components/clientes/CatalogoClientesModule.tsx`
- `src/routes/_authenticated/app.catalogos.tsx`
- `src/routes/_authenticated/app.catalogos.index.tsx`
- `src/routes/_authenticated/app.catalogos.clientes.tsx`
- `src/routes/_authenticated/app.catalogos.clientes.$clienteId.tsx`
- `src/routes/_authenticated/app.catalogos.insumos.tsx`
- `src/routes/_authenticated/app.catalogos.trabajadores.tsx`
- `src/routes/_authenticated/app.catalogos.proveedores.tsx`
- `src/routes/_authenticated/app.catalogos.subcontratistas.tsx`

Editar:
- `src/routes/_authenticated/app.clientes.tsx` → redirect a `/app/catalogos/clientes`.
- `src/components/AppShell.tsx` → sidebar.
- `src/lib/modules.ts` → quitar entrada Catálogos.
- `src/routes/_authenticated/app.admin.$.tsx` → quitar rama catalogos.
