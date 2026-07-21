## Ajuste de destinatarios de notificación de alta de trabajador

Diferenciar la audiencia según el origen de la solicitud:

- **Desde una obra** (`obra_id` presente): notificar únicamente a los **administrativos asignados al `obra_team`** de esa obra (comportamiento original), excluyendo al solicitante.
- **Desde el catálogo general** (`obra_id` null): notificar a **todos los directores y administrativos de la empresa**, excluyendo al solicitante.

### Cambios técnicos

En `src/lib/api/trabajadores.functions.ts`, dentro de `crearTrabajador`:
- Ramificar la construcción del set de destinatarios según `obra_id`.
- Mantener el link con `tab=pendientes&id=[id]` en ambos casos.
- Conservar el filtro de exclusión del solicitante.

No se tocan tablas, UI ni otras funciones.
