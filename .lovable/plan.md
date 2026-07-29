**Diagnóstico confirmado**
- La requisición **REQ-2026-001** sigue en `oc_generada`.
- Sus dos OCs (**OC-2026-001** y **OC-2026-002**) están `recibida` y con `estado_pago = pagado`.
- La función de base de datos que debe cerrarla tiene un typo: compara `estado_pago <> 'pagada'`, pero el valor real del campo es **`pagado`**. Por eso el trigger no la cerró automáticamente.

**Plan**
1. Crear una migración que corrija `public.recompute_requisicion_estatus` para usar `estado_pago = 'pagado'`.
2. Mantener el trigger actual sobre `ordenes_compra`, pero con la función corregida.
3. Ejecutar un backfill dentro de la migración para recalcular requisiciones activas existentes, incluyendo **REQ-2026-001**, y cerrarlas si todas sus OCs están recibidas y pagadas.
4. Revisar si hay lógica duplicada en código (`recalcEstatusRequisicion`) que cierre requisiciones solo por recepción sin pago, y alinearla para que el criterio sea consistente: **cerrar solo cuando todas las OCs no rechazadas estén recibidas/pagadas y pagadas**.
5. Verificar con una consulta que **REQ-2026-001** quede en `completada` y ya no aparezca en Activas.

**Resultado esperado**
- REQ-2026-001 se cerrará automáticamente.
- Las próximas requisiciones se cerrarán solas cuando todo el material esté recibido y todas las OCs estén pagadas.