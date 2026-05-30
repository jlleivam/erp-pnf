## Objetivo
Hacer que la pestaña **Comparativa** vuelva a mostrar las tarjetas y las asignaciones guardadas aunque se cierre/reabra el modal o la consulta de solicitudes llegue vacía o tarde más en cargar.

## Plan

1. **Quitar la condición que deja Comparativa en blanco**
   - Ajustar `ComparativaTable.tsx` para que no haga `return` temprano solo porque `recibidas.length === 0`.
   - Mostrar estados separados:
     - sin cotizaciones recibidas,
     - con paquetes/OCs ya guardados,
     - cargando datos relacionados.

2. **Reconstruir tarjetas desde los paquetes/OCs guardados**
   - Hacer que las tarjetas por proveedor se rendericen aunque no existan `solicitudes` recibidas en ese momento.
   - Tomar como fuente principal los `paquetes` canónicos y sus `items`, y usar `solicitudes` solo para enriquecer la matriz comparativa cuando sí existan.

3. **Rehidratar asignaciones de forma robusta**
   - Cambiar la hidratación para que no dependa exclusivamente de `solicitudByProveedor`.
   - Si existe correspondencia con solicitud recibida, poblar la matriz editable.
   - Si no existe, conservar al menos las líneas bloqueadas/read-only para que la asignación visible no desaparezca.

4. **Evitar estados vacíos falsos por timing de queries**
   - Revisar `CotizacionSheet.tsx` para distinguir entre:
     - `cotQ` listo,
     - `solsQ` cargando,
     - `solsQ` vacío real.
   - Pasar a Comparativa la información necesaria para no interpretar “todavía no cargó” como “no hay nada”.

5. **Validación final**
   - Confirmar que al volver a abrir la requisición:
     - reaparezcan las 3 tarjetas enviadas,
     - la comparativa no quede vacía,
     - las cantidades/proveedor sigan bloqueados cuando estén en autorización.

## Archivos a tocar
- `src/components/requisiciones/ComparativaTable.tsx`
- `src/components/requisiciones/CotizacionSheet.tsx`

## Detalle técnico
El fallo más probable es que hoy la vista de Comparativa depende demasiado de `solicitudes` en estatus `recibida`. Si esa colección llega vacía, tarda en cargar, o ya no mapea exactamente con los paquetes existentes, el componente sale antes de renderizar y además no puede hidratar `asignaciones`, aunque los `paquetes` y `ocs` sí sigan existiendo en backend.