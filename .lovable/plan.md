## Notificar a nivel empresa cuando la solicitud se hace desde el catálogo

Actualmente `crearTrabajador` (`src/lib/api/trabajadores.functions.ts`) sólo envía notificaciones cuando la solicitud viene con `obraId` y únicamente a los administrativos de esa obra. Al solicitar desde el catálogo (sin obra) nadie recibe aviso.

### Cambio

En `crearTrabajador`, cuando `estatus_autorizacion === "pendiente"`, calcular destinatarios como la unión de:

1. **Administrativos de la obra** (si `data.obraId` viene) — comportamiento actual.
2. **Directores de la empresa** — `user_roles` con `role = 'director'` y `company_id = companyId`.
3. **Administrativos de la empresa** — `user_roles` con `role = 'administrativo'` y `company_id = companyId`.

Filtrar duplicados y excluir al `userId` solicitante. Insertar una notificación por destinatario con:
- `tipo: "trabajador_alta_solicitada"`
- `obra_id`: el de la solicitud si existe, si no `null`
- `link: /app/catalogos/trabajadores?tab=pendientes&id=<id>`
- `mensaje`: "{quien} solicitó dar de alta a {nombre}. Requiere autorización."

Respetar `notificacion_preferencias` si ya se filtra en otros flujos (revisar patrón existente antes de insertar; si no hay helper, dejar la inserción directa como hoy).

No se toca la BD, ni el formulario, ni el catálogo — solo el server function.