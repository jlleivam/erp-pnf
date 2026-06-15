### Objetivo
Hacer cada fila del Balance General desplegable. Al expandir una cuenta se muestra el desglose por origen (ej. 2100 → cada proveedor con su saldo abierto; 2120 → cada subcontratista con su CxP pendiente).

### Arquitectura

**Backend** — nuevo server fn `getDetalleCuenta` en `src/lib/contabilidad/balance.functions.ts`:
- Input: `{ codigo: string }`.
- Verifica empresa y rol (director/administrativo), igual que `getBalanceGeneral`.
- Devuelve `{ codigo, items: Array<{ id?, etiqueta, referencia?, fecha?, saldo, linkModulo? }> }` ordenado por saldo desc.
- Si la cuenta no tiene desglose disponible, devuelve `items: []`.

**Mapeo por cuenta** (cuentas con `disponible: true`):

| Código | Fuente | Etiqueta | Referencia | Saldo |
|---|---|---|---|---|
| 1100 | `cuentas` tipo `bancaria` activas | nombre cuenta | banco | saldo_actual |
| 1110 | `cuentas` tipo `caja_fuerte` activas | nombre cuenta | — | saldo_actual |
| 1120 | `caja_chica_fondos` estatus `entregado` join `trabajadores` | nombre trabajador | folio fondo | monto_entregado |
| 1210 | `obra_destajo_anticipos` pagados − amortizaciones, agrupado por trabajador | nombre trabajador | — | saldo positivo |
| 2100 | `ordenes_compra` autorizadas/recibidas no pagadas, agrupadas por proveedor | razón social proveedor | folios | Σ(total − monto_pagado) |
| 2110 | `cuentas_por_pagar` origen `destajo_estimacion`, beneficiario `trabajador`, pendiente/parcial, agrupado por trabajador | nombre trabajador | folios CxP | Σ(monto_total − monto_pagado) |
| 2120 | `cuentas_por_pagar` origen `subcontrato_estimacion`, beneficiario `tercero`, pendiente/parcial, agrupado por tercero | razón social | folios CxP | Σ(monto_total − monto_pagado) |
| 2130 | `obra_nominas` cerradas con saldo > 0 | semana/obra | folio | monto_total − pagado |
| 2150 | `vales_gasolina` autorizados sin pagar | trabajador / unidad | folio | monto_autorizado − pagado |
| 2160 | `caja_chica_reembolsos` enviado_admin sin pagar | trabajador | folio | monto_aprobado − pagado |
| 3100 | `companies.capital_social` | "Capital social aportado" | — | capital_social |
| 3200 | no aplica desglose (es residual calculado) | — | — | — |

Cuentas con `disponible: false` (1200, 1220, 1300, 1400, 2140) no se vuelven expandibles.

### Frontend
`src/components/contabilidad/ContabilidadModule.tsx`:
1. Cambiar `SaldoRow` a un componente `Collapsible` (shadcn) cuando `s.disponible && codigo !== "3200"`.
2. Mostrar chevron a la izquierda del código; al expandir, hacer fetch con `useQuery` (key: `["balance-detalle", codigo]`, `enabled: isOpen`) llamando `getDetalleCuenta`.
3. Render del detalle: lista con `etiqueta`, `referencia` (texto chico) y `saldo` (mono, alineado a la derecha). Skeleton mientras carga. Mensaje "Sin movimientos abiertos" si vacío.
4. Si la fila ya tenía `linkModulo`, el contenedor sigue siendo clicable como antes — el botón "expandir" no debe disparar la navegación (separar el chevron del enlace para evitar conflicto).

### Sin cambios
- Catálogo contable.
- Cálculo de totales del balance (sigue usando `getBalanceGeneral`).
- Permisos.