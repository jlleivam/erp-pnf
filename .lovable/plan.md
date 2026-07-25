## Cambio

En `src/components/requisiciones/RequisicionDetalleSheet.tsx`, envolver el botón "Cancelar requisición" en un `AlertDialog` (shadcn) para exigir confirmación antes de ejecutar la mutación.

- Trigger: el mismo botón destructivo actual, sin cambios visuales.
- Contenido del diálogo:
  - Título: "Cancelar requisición"
  - Descripción: "Esta acción no se puede deshacer. La requisición quedará cancelada y no podrás enviarla nuevamente."
  - Acciones: "Volver" (cancel) y "Sí, cancelar" (destructiva) que dispara `cancelMut.mutate()`.
- El botón de confirmar refleja `cancelMut.isPending` (disabled + texto "Cancelando…").

No se toca la función `cancelarRequisicion` ni ninguna otra lógica.
