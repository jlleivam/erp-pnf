## Objetivo
Hacer que en **Comparativa** reaparezcan correctamente las tarjetas y líneas que **ya fueron enviadas a autorización del supervisor** al cerrar y volver a abrir la requisición.

## Qué voy a corregir
1. **Hidratación robusta de datos persistidos**
   - Ajustar la lógica de `ComparativaTable.tsx` para que reconstruya las asignaciones desde los **paquetes/OCs guardados** aunque las solicitudes de cotización lleguen tarde o ya no estén en estado `recibida`.
   - Evitar que el estado local vacío sobreescriba la vista persistida al volver a montar el componente.

2. **Reconstrucción de tarjetas desde datos enviados**
   - Priorizar la información ya persistida en `paquetes` + `ocs` para pintar las tarjetas de proveedores con estatus `pendiente_autorizacion`, `autorizada` o `pagada`.
   - Asegurar que esas tarjetas no dependan de que `solicitudes` siga teniendo una coincidencia activa para ese proveedor.

3. **Sincronización correcta al reabrir la requisición**
   - Revisar el criterio que reinicia `hydrated` para que vuelva a hidratar cuando cambien los datos reales del servidor, no solo por conteos parciales.
   - Corregir el caso donde la comparativa entra a un estado “vacío” aunque sí existan paquetes y OCs asociados.

## Archivos a tocar
- `src/components/requisiciones/ComparativaTable.tsx`
- Si hace falta para soportar mejor la vista, un ajuste menor en:
  - `src/lib/api/cotizaciones.functions.ts`
  - o `src/components/requisiciones/CotizacionSheet.tsx`

## Resultado esperado
- Al salir y volver a entrar a la requisición, en **Comparativa** deben volver a verse:
  - las tarjetas por proveedor ya enviadas,
  - sus líneas e importes,
  - y el badge de estatus correspondiente (por ejemplo, **Pendiente autorización**).
- No se conservarán borradores no enviados; solo lo ya persistido/enviado.

## Detalle técnico
- El problema actual está en que la comparativa reconstruye parte del estado visual usando `solicitudByProveedor` derivado solo de solicitudes `recibida`, y marca la hidratación demasiado pronto o con datos incompletos.
- La corrección será desacoplar la renderización de tarjetas persistidas respecto a ese mapeo temporal y usar como fuente principal:
  - `cotizacion_paquetes`
  - `cotizacion_paquete_insumos`
  - `ordenes_compra`
- Mantendré bloqueadas las tarjetas con OC ya enviada para que sigan siendo solo informativas hasta que cambie su estatus.

## Validación
Probaré este flujo:
1. Abrir requisición con OCs en `pendiente_autorizacion`.
2. Verificar que las tarjetas aparecen en Comparativa.
3. Cerrar el sheet.
4. Abrir de nuevo la misma requisición.
5. Confirmar que las tarjetas siguen visibles con cantidades, totales y badge correctos.