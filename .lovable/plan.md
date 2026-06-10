## Problema

La notificación "Anticipo pagado" enlaza a `/app/obras/{obraId}`, por lo que al hacer clic solo lleva al dashboard de la obra. Debe abrir el destajo correspondiente (igual que las otras notificaciones de destajo).

## Cambio

En `src/lib/api/destajos.functions.ts`, dentro de `pagarAnticipoDestajo` (línea 1740), cambiar el `link` de la notificación:

- Antes: `/app/obras/${obraId ?? ""}`
- Después: `/app/obras/${obraId}/destajos?destajo=${destajoId}`

Esto reutiliza el mismo patrón ya usado en las notificaciones de destajo solicitado/autorizado/rechazado (líneas 652, 697, 758), que `DestajosModule.tsx` ya interpreta para abrir automáticamente el `DestajoDetalleSheet` del destajo indicado en `?destajo=<id>`.

No se requieren cambios de UI ni de base de datos.