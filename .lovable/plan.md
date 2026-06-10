## Objetivo
Modificar `autorizarEstimacionDestajo` en `src/lib/api/destajos.functions.ts` para notificar al residente solicitante y al administrativo de obra cuando una estimación de destajo es autorizada.

## Cambios necesarios

1. **Notificar al residente solicitante**
   - Usar `est.creado_por` como destinatario.
   - Mensaje personalizado: `Tu estimación #N fue autorizada...`
   - Solo si `creado_por` existe y es distinto del usuario que autoriza.

2. **Notificar al administrativo de la obra**
   - Consultar `obra_team` filtrando por `obra_id = d0.obra_id` y `role = 'administrativo'`.
   - Mensaje: `Estimación #N autorizada... Lista para programar pago.`

3. **Deduplicación**
   - Evitar enviar notificaciones duplicadas si el residente o administrativo de obra también aparece en `user_roles` (administrativo/director a nivel empresa).
   - Usar un `Set` de user IDs unificados para la inserción.

4. **Tipos de notificación**
   - Residente: `estimacion_destajo_autorizada_residente`
   - Administrativo obra: `estimacion_destajo_autorizada` (mismo tipo que admins empresa, o separado si se prefiere)

## Archivo a modificar
- `src/lib/api/destajos.functions.ts` — bloque de notificaciones dentro de `autorizarEstimacionDestajo` (líneas ~1583-1610).

## Notas técnicas
- Usar `supabaseAdmin` para las consultas de notificación (ya está importado en el handler).
- Mantener el bloque `try/catch` existente para que errores de notificación no rompan la transacción principal.
- No requiere cambios en base de datos ni UI.