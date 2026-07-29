## Cambio

En `src/components/requisiciones/RequisicionesModule.tsx`, quitar la columna "Acción" de las tablas de requisiciones (vista desktop, pestañas "Activas" e "Historial"/otras) y hacer que toda la fila sea clicable, reemplazando los botones (`Cotizar`, `Continuar`, `Ver OCs`, `Ver`, `Editar borrador`) con un único destino determinado por el estado y los permisos del usuario.

## Reglas de destino al hacer click en la fila

Se conserva exactamente la misma lógica de routing que hoy tienen los botones:

- Si es **borrador** → abrir editor de borrador (`abrirBorrador`).
- Si estatus = `enviada` y tiene `cotizaciones.gestionar` → abrir cotización, tab `requisicion`.
- Si estatus = `en_cotizacion` y tiene `cotizaciones.gestionar` → abrir cotización, tab `requisicion` (Continuar).
- Si tiene `requisiciones.ver_oc` → abrir cotización, tab `ocs`.
- En cualquier otro caso → abrir visor de solo lectura (`abrirVisor`).

Esta es la misma cascada que ya existe hoy, sólo unificada en un handler de fila.

## Detalles UI

- Eliminar `<TableHead>Acción</TableHead>` y su `<TableCell>` correspondiente en las dos tablas afectadas.
- Añadir `onClick` y `cursor-pointer` a `<TableRow>`; quitar los `onClick` individuales del folio.
- Para borradores, mantener la acción destructiva "Eliminar borrador" como un pequeño ícono al final del renglón (dentro de la última celda visible), con `e.stopPropagation()` para no disparar el click de la fila. Sin esto se pierde la única forma de borrar un borrador desde la lista.
- No se toca la vista mobile (cards) ni ninguna otra pantalla.

## Fuera de alcance

- No se cambian permisos, APIs ni lógica de negocio.
- No se modifica la tabla de "Recepciones" ni otras pestañas fuera de las dos listas de requisiciones.
