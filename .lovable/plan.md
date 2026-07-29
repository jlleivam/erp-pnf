## Problema

En la vista de tabla de Requisiciones (la que ve el residente en la captura), las requisiciones en estatus `borrador` abren la hoja de Cotización tanto al hacer clic en el folio como en el botón "Ver". Desde ahí no hay forma de editar ni enviar el borrador, así que el residente queda atrapado.

En la vista de tarjetas sí funciona: el borrador abre `NuevaRequisicionSheet` con `borradorId` y muestra los botones "Guardar borrador" y "Enviar".

## Cambios

Archivo: `src/components/requisiciones/RequisicionesModule.tsx` (rama `usarVistaTabla`, líneas ~139–184).

1. Cuando `r.estatus === "borrador"`:
   - Clic en el folio → `abrirBorrador(r.id)` (misma función que usa la vista de tarjetas), no abrir `CotizacionSheet`.
   - Columna "Acción" → botón "Editar" que también llama `abrirBorrador(r.id)`, más un botón de eliminar (ícono papelera) que dispara `eliminarBorrador.mutate(r.id)` con confirmación, igual que en tarjetas.
   - Mantener el badge "Borrador" en la columna de estatus.
2. El resto de estatus se comporta igual que hoy.

No se tocan permisos, backend, ni la vista de tarjetas: la lógica de envío (`enviarBorradorRequisicion`) y los permisos (`requisiciones.crear`) ya están bien; el bug es puramente de ruteo de UI en la tabla.
