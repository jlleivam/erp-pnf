## Objetivo

Crear un módulo completo de notificaciones accesible desde la campana del header: al hacer clic en la campana se sigue mostrando el popover actual, pero ahora el título **"Notificaciones"** se convierte en un enlace que abre el módulo completo en `/app/notificaciones`.

## Cambios

1. **Nueva ruta `src/routes/app.notificaciones.tsx`**
   - `head()` con título y descripción propios.
   - Renderiza `<NotificacionesModule />` dentro del `AppShell` existente.

2. **Nuevo componente `src/components/notificaciones/NotificacionesModule.tsx`**
   - Header del módulo con título y botón "Marcar todas como leídas".
   - Tabs: **Todas**, **No leídas**, **Leídas**.
   - Filtro por tipo de notificación (select) y búsqueda por texto en título/mensaje.
   - Lista completa (paginada o con scroll) con: icono según tipo, título, mensaje, fecha y hora (`formatDateTime`), indicador visual de no leída.
   - Al hacer clic en un renglón: marca como leída y navega al `link_url` si existe.
   - Estado vacío amigable.
   - Reutiliza `listNotificaciones`, `marcarLeida` y `marcarTodasLeidas`; se extiende `listNotificaciones` para aceptar un `limit` mayor y opcional filtro por estatus si aún no lo soporta.

3. **`src/components/NotificacionesBell.tsx` (popover actual)**
   - Convertir el título **"Notificaciones"** del popover en un botón/`Link` que navega a `/app/notificaciones` y cierra el popover.
   - Mantener intacto el resto del comportamiento (lista rápida, "Marcar todas", clic en item).
   - Opcional: agregar un pequeño enlace "Ver todas" al pie del popover con la misma navegación, por si el usuario no descubre el título clickeable.

## Notas técnicas

- Sin cambios de esquema en base de datos.
- Invalidar los queries `["notificaciones"]` y `["notificaciones", "no-leidas"]` tras cada mutación para mantener sincronizados campana y módulo.
- Seguir el patrón TanStack Query del proyecto: `ensureQueryData` en el loader + `useSuspenseQuery` en el componente.
