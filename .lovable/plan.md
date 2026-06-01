## Problema

El banner "La asignación local difiere de la OC enviada. Las ediciones se ignorarán…" aparece al enviar la OC al supervisor. Como al enviar la solicitud los insumos del cuadro comparativo quedan bloqueados, el usuario no puede editarlos, por lo que el aviso no tiene sentido y solo confunde.

## Cambio

En `src/components/requisiciones/ComparativaTable.tsx`:

- Eliminar el bloque de render del banner (líneas 916-920).
- Eliminar el cálculo de `dirty` (líneas 765-776) que solo se usaba para ese banner.

## Lo que NO cambia

- Lógica de bloqueo de insumos al enviar al supervisor.
- Envío, autorización, rechazo o reapertura de OC.
- Resto de avisos y badges de la tarjeta por proveedor.

## Validación

- Enviar una OC al supervisor → no debe aparecer ningún banner amarillo.
- El resto del flujo (badges de estatus, botones de acción) sigue funcionando igual.
