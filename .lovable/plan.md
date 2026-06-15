### Objetivo
Diferenciar entre estimaciones autorizadas (cerradas) y pagos realmente efectuados al subcontratista.

### Estado actual
- Columna "Pagado" suma `monto_total` de estimaciones con `estatus = 'cerrada'`.
- "Cerrada" significa autorizada para pago, no pagada efectivamente.
- El pago real ocurre cuando la Cuenta por Pagar (`cxp_id` en la estimación) se paga (`cuentas_por_pagar.monto_pagado`).

### Cambios

#### 1. Backend (`src/lib/api/subcontratos.functions.ts` → `listSubcontratos`)
- Renombrar el cálculo actual de "pagado" a `autorizado_acumulado` (suma de estimaciones cerradas, lógica actual).
- Calcular `pagado_acumulado` real: sumar `monto_pagado` de las `cuentas_por_pagar` referenciadas por `cxp_id` de las estimaciones del subcontrato. Si la estimación no tiene `cxp_id`, contribuye 0.
- Devolver: `monto_total`, `estimado_acumulado`, `autorizado_acumulado`, `pagado_acumulado`.

#### 2. UI (`src/components/subcontratos/SubcontratosModule.tsx`)
- Agregar columna **Autorizado** entre Estimado y Pagado.
- Columnas finales de derecha a izquierda: `Contratado · Estimado · Autorizado · Pagado`.
- El `%` mostrado junto a Pagado se calcula como `pagado_acumulado / monto_total`.
- Actualizar el tipo `Subcontrato` con `autorizado_acumulado: number`.
- Las KPIs superiores (Contratado vigente, Pagado acumulado, Subcontratos activos) ya usan `pagado_acumulado`; ahora reflejarán pagos reales — sin cambios estructurales adicionales.

### Sin cambios
- Permisos, mutaciones, detalle del subcontrato (`SubcontratoDetalleSheet`), módulo de destajos.
- Esquema de base de datos.

### Notas
- Como `cuentas_por_pagar` ya tiene `monto_pagado` mantenido por el flujo de pagos existente, no se requieren migraciones ni nuevas tablas.