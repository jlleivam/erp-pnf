
## Objetivo

Agregar una pestaña **"Nómina"** en Cuentas por Pagar donde el administrativo liquida la nómina semanal combinando **cheques bancarios** (a nombre de trabajadores activos) y el **complemento en vales de efectivo desde caja fuerte** (cuenta 1110). Se emite **un único vale de efectivo por obra** (no por trabajador) para simplificar el flujo, cargado a la obra correspondiente.

## UI

Nuevo `src/components/pagos/NominaPorPagarTab.tsx` con la misma mecánica visual de las otras pestañas:

- Lista de **semanas con nómina pendiente de pago** (todas las obras con `obra_nominas.estatus = 'cerrada'` en esa semana), agrupada por `semana_inicio/semana_fin`, con: rango, # obras, total a pagar.
- Acción **"Pagar semana"** por fila, sólo habilitada si todas las nóminas de la semana están `cerrada`. Abre sheet `PagarNominaSemanaSheet`:
  - Total a pagar.
  - **Cheques**: lista editable con `cuenta bancaria` (combobox de `cuentas` tipo banco), `folio`, `beneficiario` (combobox de trabajadores activos), `monto`. Suma en vivo.
  - **Remanente = Total − Σ cheques** en grande.
  - **Vales de efectivo (auto)**: tabla read-only con **una fila por obra**, cada una con el monto del vale = remanente prorrateado por el peso de esa obra en la semana. Origen fijo: caja fuerte (1110). No se desglosa por trabajador.
  - Botón **Confirmar pago** deshabilitado si Σ cheques > total, saldo caja fuerte < Σ vales, o hay cheques incompletos.
- Sub-filtro **"Historial"** para semanas ya pagadas.

`NominaAdminPanel` mantiene sólo la visión consolidada (sin botón de pago).

## Contabilidad al confirmar

Ya existente al cerrar cada nómina: cargo `5100 Costo de obra - Mano de obra` / abono `2140 Sueldos por pagar` (se mantiene).

Al aplicar el pago:
- Por cada **cheque**: cargo `2140` / abono `1110-<banco>`, prorrateado a las obras según su peso en la semana (trazabilidad por obra).
- Por cada **vale (uno por obra)**: cargo `2140` / abono `1110 Caja fuerte` con `obra_id`.
- Un `pagos` por cheque (`metodo='cheque'`, `referencia=folio`, `cuenta_id=banco`) y **un solo `pagos` por obra** (`metodo='efectivo'`, `cuenta_id=caja fuerte`, `obra_id`), todos con `origen_tipo='nomina_semana'`.
- `cuenta_movimientos` para actualizar saldos.

## Datos

- Enum `nomina_estatus`: agregar `pagada`.
- `obra_nomina_pagos_semana`: `id, company_id, semana_inicio, semana_fin, monto_total, monto_cheques, monto_vales, pagado_por, pagado_at, notas`.
- `obra_nomina_pagos_semana_cheques`: `pago_semana_id, cuenta_id, folio, trabajador_id, monto, pago_id`.
- `obra_nomina_pagos_semana_vales`: **una fila por obra** — `pago_semana_id, obra_id, monto, pago_id` con `UNIQUE(pago_semana_id, obra_id)`.
- GRANTs a `authenticated`/`service_role`, RLS por `company_id`.
- Al confirmar, cada `obra_nominas` de la semana pasa `cerrada` → `pagada`.

## API (`src/lib/api/nominas.functions.ts`)

- `listSemanasNominaPorPagar()` — semanas con al menos una `obra_nominas` cerrada no pagada.
- `getResumenPagoSemana(semanaInicio)` — obras + importes para el sheet.
- `pagarNominaSemana({ semanaInicio, cheques[] })` — valida, prorratea, crea asientos, `pagos`, `cuenta_movimientos`, marca nóminas como `pagada`.
- `listHistorialPagosNomina()`.

## Detalles

- Prorrateo cheque → obras y remanente → vale por obra: `monto * (importeObra / totalSemana)`, con ajuste de centavos en la última obra.
- Notificación `nomina_pagada` al director al confirmar.
- Pestaña visible sólo a `director` y `administrativo`.
