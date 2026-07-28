## Cerrar el popover al hacer clic en "Ver todas las notificaciones"

En `src/components/NotificacionesBell.tsx`, el `Popover` es no controlado, así que la navegación no lo cierra.

### Cambios
- Controlar el estado con `const [open, setOpen] = useState(false)` y pasar `open`/`onOpenChange` al `<Popover>`.
- En los handlers que navegan (encabezado "Notificaciones", el link "Ver todas las notificaciones", y `handleOpen` al abrir una notificación individual), llamar `setOpen(false)` después de `navigate(...)`.