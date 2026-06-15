### Problema
La cuenta **2120 Subcontratistas por pagar** muestra $0 a pesar de tener estimaciones autorizadas con Cuenta por Pagar pendiente.

### Causa
En `src/lib/contabilidad/balance.functions.ts`:
1. Consulta `obra_subcontrato_estimaciones` filtrando por `estatus = 'cerrada'`, pero las estimaciones autorizadas usan `estatus = 'autorizada'`.
2. Suma `monto_total` de la estimación (bruto), no el neto que efectivamente se debe al subcontratista.
3. Descuenta pagos con `origen_tipo = 'subcontrato'`, pero los pagos reales se registran con `origen_tipo = 'subcontrato_estimacion'`.

### Solución
Alinear la lógica con la de **Destajistas por pagar (2110)** que sí funciona: consultar directamente `cuentas_por_pagar` filtrando por:
- `beneficiario_tipo = 'tercero'`
- `origen_tipo = 'subcontrato_estimacion'`
- `estatus IN ('pendiente', 'parcial')`
- `cancelado_at IS NULL`

Calcular `subcontratistasPorPagar = Σ max(0, monto_total − monto_pagado)`.

### Cambios
**Archivo:** `src/lib/contabilidad/balance.functions.ts`

1. Reemplazar `subEstimRes` por un query a `cuentas_por_pagar` con los filtros anteriores.
2. Recalcular `subcontratistasPorPagar` con el mismo patrón que `destajistasPorPagar`.
3. Eliminar el cálculo basado en `pagado("subcontrato")` (queda obsoleto).

### Sin cambios
- UI del balance (`ContabilidadModule.tsx`).
- Catálogo contable.
- Flujos de creación de CxP de subcontratos.
- Otras filas del balance.