## Notificar al administrador cuando el residente solicite un alta de trabajador

### Contexto
- `crearTrabajador` (`src/lib/api/trabajadores.functions.ts`) ya distingue dos casos por permisos:
  - **Administrador/director** → crea el trabajador como `estatus_autorizacion = "autorizado"`.
  - **Residente** (solo puede solicitar) → se crea como `estatus_autorizacion = "pendiente"`.
- La tabla `notificaciones` ya existe con las columnas necesarias (`user_id`, `company_id`, `obra_id`, `tipo`, `titulo`, `mensaje`, `link`).
- Existe un patrón idéntico de notificación en `requisiciones.functions.ts` (líneas 232–268) que se usará como referencia.

### Cambio único
**Archivo:** `src/lib/api/trabajadores.functions.ts` → función `crearTrabajador`

Después del `insert` exitoso, si `estatus_autorizacion === "pendiente"`, emitir notificación a los `administrativo` y `director` de la empresa (excluyendo al propio solicitante):

1. Consultar `user_roles` de la empresa con `role IN ('administrativo', 'director')`.
2. Obtener el `nombre_completo` del residente solicitante desde `profiles`.
3. Insertar un registro en `notificaciones` por cada destinatario con:
   - `tipo`: `"trabajador_alta_solicitada"`
   - `titulo`: `"Solicitud de alta de trabajador"`
   - `mensaje`: `"{Residente} solicitó dar de alta a {nombre_completo}. Completa su registro y alta ante el IMSS."`
   - `link`: `"/app/admin/trabajadores"` (la pestaña Trabajadores ya filtra pendientes con la sub-pestaña "Pendientes" visible para director/admin).
   - `company_id` y `obra_id: null` (el trabajador es del catálogo de empresa, no de una obra específica).
4. Usar `supabaseAdmin` (importado dinámicamente con `await import(...)`) para el insert, igual que en requisiciones.
5. Envolver todo en try/catch que solo haga `console.error` — la falla de notificación no debe romper la creación.

### Lo que NO cambia
- Comportamiento cuando un administrador/director crea el trabajador directamente (no se notifica, ya queda `autorizado`).
- Esquema de base de datos (la tabla `notificaciones` ya tiene los campos requeridos).
- UI del residente: sigue usando el mismo `TrabajadorFormDialog` desde la nómina (`CapturaNominaSheet`) o desde el catálogo.
- Campana de notificaciones del administrador: ya consume `listMisNotificaciones`, así que recibe el nuevo tipo sin cambios adicionales.
- Vista de "Pendientes" en el catálogo de trabajadores (ya existe, sin cambios).

### Detalle técnico (campo `link`)
La notificación apunta a `/app/admin/trabajadores`. El módulo `CatalogoTrabajadoresModule` ya tiene la pestaña "Pendientes" visible para roles `director`/`administrativo`, por lo que el administrador podrá editar el registro y marcar el alta ante el IMSS desde ahí.