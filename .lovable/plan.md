Cambiar el botón azul "Guardar y descargar PDF" del formulario de nueva solicitud de cotización para que únicamente guarde la solicitud, sin generar ni descargar el PDF.

El PDF se descargará posteriormente desde la lista de solicitudes ya guardadas, donde ya existe el botón "Descargar PDF".

Archivo a modificar: `src/components/requisiciones/SolicitudesTab.tsx`
- Cambiar el `onClick` del botón azul de `mut.mutate({ descargarPDF: true })` a `mut.mutate({ descargarPDF: false })`
- Cambiar el texto del botón de "Guardar y descargar PDF" a "Guardar solicitud"
- Eliminar el ícono `<Download />` del botón azul

El botón outline "Guardar borrador" se mantiene como alternativa.