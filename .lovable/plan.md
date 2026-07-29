## Objetivo

Agregar la sección **Presupuestos** al catálogo de permisos para gobernar presupuesto base y órdenes de cambio, y reemplazar los checks por rol hardcodeados en cliente y servidor.

## Nuevas acciones en `src/lib/permisos/catalogo.ts`

Módulo **Presupuestos**:
- `presupuestos.crear_base` — Crear/editar presupuesto base (default: NONE; hoy solo Director por bypass).
- `presupuestos.autorizar_base` — Autorizar/rechazar presupuesto base (default: NONE; hoy solo Director).
- `presupuestos.eliminar_base` — Eliminar presupuesto base (default: NONE).
- `presupuestos.crear_oc` — Crear orden de cambio (default: residente).
- `presupuestos.enviar_oc` — Enviar OC a autorización (default: residente).
- `presupuestos.autorizar_oc` — Autorizar/rechazar orden de cambio (default: supervisor).
- `presupuestos.eliminar_oc` — Eliminar orden de cambio en borrador (default: residente).

Director siempre bypasea (comportamiento actual del framework).

## Cambios en servidor — `src/lib/api/presupuestos.functions.ts`

Sustituir los checks por rol por `requirePermission(supabase, userId, <key>)`:

- `guardarPresupuesto` (base) → `presupuestos.crear_base`.
- `guardarPresupuesto` (OC) → `presupuestos.crear_oc`.
- `actualizarPresupuesto` → `presupuestos.crear_base` si base / `presupuestos.crear_oc` si OC.
- `enviarPresupuesto` OC → `presupuestos.enviar_oc`.
- `autorizarPresupuesto` base → `presupuestos.autorizar_base`.
- `autorizarPresupuesto` OC → `presupuestos.autorizar_oc`.
- `rechazarPresupuesto` base → `presupuestos.autorizar_base`; OC → `presupuestos.autorizar_oc`.
- `eliminarPresupuesto` base → `presupuestos.eliminar_base`; OC → `presupuestos.eliminar_oc`.
- Regla "quien envía no puede autorizar su propia OC" se mantiene además del permiso.

Se conserva el helper `getCompanyAndIsDirector` solo para consultas de estado, no para autorización.

## Cambios en UI — `src/components/presupuesto/PresupuestoModule.tsx`

Reemplazar `director / isResidente / isSupervisor` en la lógica de visibilidad de botones por `can(<key>)` del hook `usePermisos`:

- Botón "Nueva orden de cambio" / crear base → `presupuestos.crear_base` / `presupuestos.crear_oc`.
- Editar → `presupuestos.crear_base` / `presupuestos.crear_oc`.
- Enviar OC → `presupuestos.enviar_oc`.
- Autorizar/Rechazar → `presupuestos.autorizar_base` / `presupuestos.autorizar_oc`.
- Eliminar → `presupuestos.eliminar_base` / `presupuestos.eliminar_oc`.

Se mantiene el flag "no autorizar propia OC" en cliente para no mostrar el botón al propio remitente.

## Fuera de alcance

- No se toca RLS ni migraciones.
- No se cambia comportamiento por defecto: los defaults reproducen el estado actual (Director-only para base; residente/supervisor para OC).
