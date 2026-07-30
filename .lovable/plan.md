## Objetivo

Convertir la pestaña **Nómina** de Cuentas por pagar en un monitor semanal completo: hoy sólo muestra nóminas ya cerradas, así que el administrativo no ve si un residente aún tiene su nómina abierta (borrador) o ni siquiera la ha iniciado.

## Qué se verá

Por cada semana, una fila con:
- Rango de la semana.
- Un resumen de estado de las obras: `2 cerradas · 1 abierta · 1 sin capturar`.
- Total de la semana (cerradas) y, aparte, monto en captura (borradores).
- Badge rojo de duplicados (se conserva).
- Botón **Pagar semana**, deshabilitado con tooltip cuando hay duplicados **o** cuando aún hay nóminas abiertas/sin capturar (con opción de pagar sólo las cerradas mediante confirmación; ver preguntas abajo — por defecto se permite pagar sólo las cerradas y se avisa).

Al expandir la fila (chevron), se lista cada obra activa de esa semana con:
- Nombre de la obra y residente responsable.
- Estado: `Cerrada` (verde), `Abierta` (ámbar), `Pagada` (gris), `Sin capturar` (outline).
- Fecha/hora de cierre (`cerrada_at`) cuando aplica.
- Monto.

## Cambios técnicos

**`src/lib/api/nominas.functions.ts`** — reescribir `listSemanasNominaPorPagar`:
- Traer nóminas con estatus `borrador` y `cerrada` (no sólo cerradas), incluyendo `cerrada_at`.
- Traer las obras activas de la empresa y su residente (vía `obra_team` / `profiles`) para calcular las obras "sin capturar" en cada semana listada.
- Devolver por semana: `total_cerrado`, `total_borrador`, `obras[]` con `{ obra_id, obra_nombre, residente, estatus: 'cerrada'|'borrador'|'sin_capturar', monto, cerrada_at, nomina_id }`, `nomina_ids` (sólo cerradas, para el pago), contadores `cerradas/abiertas/sin_capturar` y `duplicados`.
- Mantener `assertAdmin` y el conteo de duplicados actual.

**`src/components/pagos/NominaPorPagarTab.tsx`**:
- Actualizar el tipo `SemanaNominaRow`.
- Fila expandible con el desglose por obra y badges de estado.
- Columna "Estado obras" con el resumen y tooltips donde el texto no quepa.
- El botón `Pagar semana` sigue mandando sólo `nomina_ids` de nóminas cerradas al sheet existente; si hay abiertas, mostrar aviso en el tooltip de que quedarán fuera del pago.
- Encabezado y descripción del panel actualizados ("Monitor semanal de nóminas").

No se toca `PagarNominaSemanaSheet` ni `pagarNominaSemana`, ni se requiere migración de base de datos.
