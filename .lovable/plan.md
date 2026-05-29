## Objetivo

Reforzar el flujo de "Enviar a supervisor" en la pestaña Comparativa:

1. Al enviar a supervisor, el botón de la tarjeta del proveedor debe cambiar a un botón **"Pendiente de autorización"** deshabilitado (no a solo un texto suelto).
2. Las líneas asignadas a un pedido pendiente o autorizado no deben poder reasignarse a otro proveedor (ya parcialmente cubierto por `provBloqueado`).
3. Cuando el supervisor autoriza la OC, la tarjeta del proveedor **permanece visible en Comparativa** pero solo muestra el estatus **Autorizada** (sin acciones, en modo lectura). La OC autorizada también aparece en la pestaña **OCs** para hacer los pedidos finales.

## Cambios

### `src/components/requisiciones/ComparativaTable.tsx`

1. **Botón "Pendiente de autorización"**
   En la rama `estatus === "pendiente_autorizacion"` de las acciones de la tarjeta:
   - Si el usuario **no es supervisor**, reemplazar el `<p>Esperando autorización del supervisor</p>` por un `<Button disabled>` con ícono `Clock` y texto "Pendiente de autorización".
   - Si es supervisor, mantener Autorizar / Rechazar como hoy.

2. **Tarjeta autorizada en modo lectura**
   La rama `estatus === "autorizada"` ya muestra el texto "Autorizada" sin acciones — mantener. Confirmar que toda la fila/insumo siga bloqueada en la matriz vía `provBloqueado` (ya cubierto: devuelve true para `autorizada`).

3. **Importar `Clock`** desde `lucide-react`.

### Sin cambios

- Server functions (`enviarOCASupervisor`, `autorizarOC`, `rechazarOC`).
- Base de datos.
- Pestaña OCs (`CotizacionSheet.tsx`) — ya lista todas las OCs autorizadas.

## Riesgos

Mínimo. Cambio puntual de UI en la sección de acciones de la tarjeta del proveedor.
