## Diagnóstico

La OC-2026-001 muestra "Pendiente de recibir" aunque las cantidades recibidas coinciden exactamente con las pedidas (50/50 y 5/5).

**Causa raíz:** En `registrarRecepcion` (`src/lib/api/almacen.functions.ts`), después de insertar las partidas se recalcula el estatus de la OC con:

```ts
await supabase.from("ordenes_compra")
  .update({ estatus: nuevoEstatus })
  .eq("id", oc.id);
```

Este `update` corre con el cliente autenticado del usuario (RLS aplica). Las políticas actuales de `ordenes_compra` solo permiten UPDATE a:
- Director / Administrativo
- Supervisor de la obra

El residente que registró la recepción (`role = residente`) **no** cumple ninguna, así que el UPDATE afecta 0 filas y no lanza error. La recepción se guarda, pero el estatus queda como `enviada`.

## Cambios propuestos

1. **`src/lib/api/almacen.functions.ts` — hacer el cambio de estatus con cliente privilegiado**
   - Cargar `supabaseAdmin` dentro del handler (`await import("@/integrations/supabase/client.server")`) después de que ya se validó que el usuario tiene permiso de almacén sobre esa obra (vía `assertPuedeEditarAlmacen`) y que la OC pertenece a su company.
   - Ejecutar el `UPDATE ordenes_compra SET estatus = ...` con `supabaseAdmin` (mismo criterio que ya se usa en otras funciones que necesitan bypass controlado de RLS).
   - Revisar el resultado y lanzar error si `error` no es nulo, para que a futuro no vuelva a fallar en silencio.

2. **Reparar el dato existente**
   - Una migración corta que recalcule y corrija el estatus de OCs que actualmente están en `enviada` / `recibida_parcial` pero cuyo total recibido ya cubre lo pedido. Con esto la OC-2026-001 (y cualquier otra en el mismo caso) pasará a `recibida` sin necesidad de que el usuario vuelva a capturar nada.

## No se toca

- Políticas RLS de `ordenes_compra` (se mantienen restrictivas para cambios manuales; el paso privilegiado ocurre solo dentro de la función validada del servidor).
- UI de almacén ni la lógica de recepciones/partidas.

## Verificación

- Registrar una recepción de prueba como residente y confirmar que la OC pasa a `recibida` / `recibida_parcial` según corresponda.
- Consultar OC-2026-001: debe quedar en `recibida` tras la migración de reparación.
