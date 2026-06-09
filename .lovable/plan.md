## Objetivo

Desbloquear la captura de asistencia en la nómina semanal para trabajadores que están asignados a un destajo. El sistema seguirá mostrando el aviso visual (badge "Destajo: …") como ya lo hace, pero la fila quedará editable.

## Cambios

**`src/components/nomina/CapturaNominaSheet.tsx`**

1. Mantener el cálculo de `bloq` / `bloqueadosMap` solo para mostrar el badge informativo "Destajo: {nombre}" junto al nombre del trabajador (sin cambios visuales en esa parte).
2. Eliminar el efecto de bloqueo:
   - Quitar `filaBloqueada` del `disabled` de `DiaCell` (línea 255 → `disabled={!!isClosed}`).
   - Quitar el fondo `bg-muted/30` aplicado a la fila por estar en destajo (línea 222).
   - Mostrar siempre los valores reales en las columnas "Días", "Extras h" e "Importe" (líneas 267, 270, 273–277): eliminar el ternario `filaBloqueada ? "—" : …` y el texto "vía destajo".
3. Opcional menor: cambiar el ícono `Lock` del badge por algo informativo (mantener `Lock` si se prefiere conservar el look actual — confirmar en la implementación, default: dejarlo igual).

No se tocan los server functions ni la lógica de destajos/estimaciones. El usuario que asigne trabajador a un destajo seguirá viendo el aviso, pero podrá capturar asistencia normalmente en la nómina.

## Fuera de alcance

- `AsignarTrabajadoresDialog` (lógica de selección de trabajadores para un destajo) — sigue igual.
- Cálculo de importe en destajos / estimaciones — sin cambios.
