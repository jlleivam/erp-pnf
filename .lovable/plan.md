# Notificación de alta de trabajador: link útil + aviso al residente al autorizar

## Comportamiento

1. **Click en la notificación "Solicitud de alta de trabajador"** (admin/director) lleva al catálogo de trabajadores en la pestaña **Pendientes**, con el trabajador solicitado abierto en su panel de detalle, listo para completar el registro y autorizar.
2. **Al cambiar el estatus a "autorizado"** (botón "Autorizar"/"Registrar" en catálogo o detalle), el residente que originalmente envió la solicitud recibe una notificación: *"Trabajador autorizado – Isaac Martinez Gonzalez ya fue registrado y autorizado."* Al hacer click, se le lleva al catálogo de trabajadores con ese trabajador abierto.

## Cambios

### `src/lib/api/trabajadores.functions.ts`

- **`crearTrabajador`** – en la notificación al admin, cambiar `link` de `/app/admin/trabajadores` (placeholder roto) a:
  `/app/catalogos/trabajadores?tab=pendientes&id=<trabajador.id>`

- **`autorizarTrabajador`** – después del `update`:
  1. Hacer un `select` previo del trabajador (`creado_por, nombre_completo, company_id`) usando `supabase` (con RLS).
  2. Si `creado_por` existe y es distinto del `userId` actual, insertar una notificación con `supabaseAdmin`:
     - `user_id`: `creado_por`
     - `company_id`: el del trabajador
     - `tipo`: `"trabajador_alta_autorizada"`
     - `titulo`: `"Trabajador autorizado"`
     - `mensaje`: `"${nombre_completo} ya fue registrado y autorizado. Ya puedes asignarlo a la nómina semanal."`
     - `link`: `/app/catalogos/trabajadores?id=<id>`
  3. Errores de notificación se loggean pero no rompen la autorización (mismo patrón que `crearTrabajador`).

### `src/routes/_authenticated/app.catalogos.trabajadores.tsx`

Agregar `validateSearch` para aceptar `tab` (`"todos" | "pendientes"`) e `id` (uuid). Ambos opcionales.

### `src/components/trabajadores/CatalogoTrabajadoresModule.tsx`

- Leer `tab` e `id` con `Route.useSearch()` (importando la ruta).
- En un `useEffect`: si `tab === "pendientes"`, setear `setTab("pendientes")`; si `id` está presente, `setDetalleId(id)`.
- Sólo aplicar al montar / cuando cambien los params (no sobreescribir cambios manuales del usuario después).

## Sin cambios

- Schema, RLS, tabla `notificaciones` (ya soporta `tipo` libre).
- Flujo de creación o de autorización en sí (sólo se añade la notificación posterior).
- `NotificacionesBell` (ya navega a `n.link` cuando existe).
- Otros componentes.

¿Procedo?
