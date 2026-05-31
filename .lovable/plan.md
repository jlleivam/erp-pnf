# Plan para que la comparativa no se vacíe al reabrir

## Objetivo
Hacer que la pestaña **Comparativa** se reconstruya con la información ya analizada y enviada, usando como base los **paquetes guardados** y las **OCs** ya generadas, para que al cerrar y volver a abrir la requisición no aparezca vacía.

## Qué voy a cambiar

1. **Convertir paquetes/OC en la fuente de verdad visible de la comparativa**
   - Ajustar la lógica de `ComparativaTable` para que las tarjetas por proveedor se reconstruyan siempre desde los paquetes persistidos y, cuando exista OC, conserven también el contexto del proveedor/estatus.
   - Evitar que la vista dependa de estado efímero de edición o de que sigan existiendo solicitudes `recibida` para poder mostrar lo ya trabajado.

2. **Separar claramente “matriz editable” de “resumen persistido”**
   - Mantener la tabla comparativa editable dependiente de las cotizaciones recibidas.
   - Mantener las tarjetas/resumen de pedido dependientes de datos persistidos (`cotizacion_paquetes` + `ordenes_compra`), incluso si la matriz ya no puede rearmarse completa.
   - Si ya existe análisis persistido pero no hay suficientes cotizaciones para reconstruir la matriz, mostrar las tarjetas y un mensaje claro, en vez de una comparativa vacía.

3. **Alimentar la comparativa con lo enviado a supervisor**
   - Al enviar una OC, asegurar que el paquete asociado quede como referencia visible para rehidratación posterior.
   - Priorizar el paquete vinculado a la OC canónica por proveedor para que la tarjeta muestre exactamente lo que ya fue enviado/revisado.

4. **Mejorar el flujo de reapertura desde la vista administrativa**
   - Ajustar la acción de requisiciones en estatus `pendiente_autorizacion`, `oc_generada` y `completada` para que el usuario pueda volver directamente a una vista útil de seguimiento, en lugar de depender solo de la pestaña de OCs.
   - La idea es que la comparativa siga siendo accesible como historial analítico, no solo como editor.

## Archivos a tocar
- `src/components/requisiciones/ComparativaTable.tsx`
- `src/components/requisiciones/CotizacionSheet.tsx`
- `src/routes/_authenticated/app.admin.requisiciones.tsx`

## Detalles técnicos
- Hoy la carga inicial de la cotización ya trae:
  - requisición
  - paquetes con items
  - OCs
  desde `getCotizacionRequisicion` en `src/lib/api/cotizaciones.functions.ts`.
- Eso significa que **no hace falta cambiar backend ni esquema** para resolver este problema.
- El ajuste principal será en la forma de hidratar/renderizar la comparativa:
  - usar `cotizacion_paquetes.items` como base persistida
  - usar `ordenes_compra.estatus` para bloquear edición pero no ocultar información
  - no depender de `solicitudes` para volver a mostrar tarjetas ya consolidadas

## Validación
1. Crear requisición.
2. Capturar cotizaciones.
3. Asignar proveedores.
4. Enviar una o varias OCs a supervisor.
5. Cerrar la requisición.
6. Volver a abrirla.
7. Verificar que:
   - la pestaña **Comparativa** siga mostrando las tarjetas con líneas, importes y estatus;
   - la información coincida con lo enviado a aprobación;
   - si la matriz ya no puede editarse, al menos siga visible el resumen ya analizado;
   - la pestaña **OCs** y **Comparativa** sean consistentes entre sí.

## Resultado esperado
La comparativa dejará de sentirse “temporal”: lo ya analizado y enviado quedará visible al reabrir, usando los paquetes/OCs como historial persistido del análisis.