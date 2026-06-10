## Diagnóstico

La estimación de destajo autorizada **SÍ generó** correctamente la CxP y el asiento contable en la base:

- `cuentas_por_pagar` → `CxP-2026-0001`, beneficiario "Nelson Cruz", $2,210, estatus `pendiente`.
- `asientos_contables` → renglones con "Cuentas por pagar - Contratistas destajo" $2,210.

Pero dos módulos no leen esa fuente:

1. **CuentasPorPagarModule** sólo lista proveedores OC y la pestaña de anticipos de destajo. Nunca muestra `cuentas_por_pagar`.
2. **`balance.functions.ts`** calcula "Destajistas por pagar" filtrando `obra_destajo_estimaciones` por `estatus = 'cerrada'`. Al autorizarse pasa a `'autorizada'` y desaparece → 2110 muestra $0.

## Plan

### A. Renombrar pestaña "Anticipos de destajo" → "Destajos" y mostrar ambas listas

**`src/lib/api/pagos.functions.ts`** — nuevo serverFn `listCxPDestajoPendientes` (GET, director/administrativo) que lee `cuentas_por_pagar` con `beneficiario_tipo='trabajador'`, `origen_tipo='destajo_estimacion'`, `estatus IN ('pendiente','parcial')`, `cancelado_at IS NULL`. Devuelve: `id, folio, fecha_emision, obra_id, obra_nombre, beneficiario_nombre, concepto, monto_total, monto_pagado, saldo, estatus, origen_id (estimación)`.

**`src/components/pagos/CuentasPorPagarModule.tsx`**
- Renombrar `<TabsTrigger value="anticipos">Anticipos de destajo</TabsTrigger>` → `Destajos`.
- Dentro del `TabsContent value="anticipos"`, dividir en dos secciones (subtítulos, no sub-tabs):
  - **Estimaciones por pagar** — tabla nueva poblada por `listCxPDestajoPendientes`: Folio · Obra · Destajista · Concepto · Total · Pagado · Saldo · Estatus · Acción ("Registrar pago" → abre `RegistrarPagoCxPDialog`).
  - **Anticipos pendientes** — la tabla existente de `listAnticiposDestajoPendientes` sin cambios.
- El badge contador de la pestaña suma `estimaciones_pendientes + anticipos_pendientes`.

**`src/components/pagos/RegistrarPagoCxPDialog.tsx`** (nuevo) — análogo a `RegistrarPagoOCDialog`, pero opera sobre `cuentas_por_pagar`. Llama a `registrarPagoCxP` (nuevo serverFn) que:
1. Valida cuenta activa, método compatible y monto ≤ saldo.
2. Inserta en `pagos` con `origen_tipo='cxp'`, `origen_id=cxp.id`, concepto `Pago CxP {folio} · {beneficiario}`.
3. Inserta `cuenta_movimiento` egreso y descuenta saldo de la cuenta.
4. Actualiza `cuentas_por_pagar.monto_pagado` y `estatus` (`pendiente`→`parcial`→`pagada`).
5. Inserta asiento doble partida: cargo "Cuentas por pagar - Contratistas destajo" (o subcontratistas / nómina cuando aplique) y abono a "Bancos" / "Caja fuerte" según el tipo de cuenta usada.
6. Invalida queries `["saldos-destajo-cxp"]`, `["balance"]`, etc.

### B. Corregir cálculo del Balance (2110)

**`src/lib/contabilidad/balance.functions.ts`** — reemplazar la consulta de "Destajistas por pagar" para que venga de `cuentas_por_pagar` (saldo pendiente = `monto_total - monto_pagado`):

```text
WHERE company_id = ?
  AND beneficiario_tipo = 'trabajador'
  AND origen_tipo = 'destajo_estimacion'
  AND estatus IN ('pendiente','parcial')
  AND cancelado_at IS NULL
```

Eliminar el descuento por `pagado("destajo")` ya que el saldo de la CxP ya es la verdad. Subcontratistas (2120) y Nómina (2130) se dejan tal cual hasta que también escriban a `cuentas_por_pagar`.

### Sin cambios

- Flujo de autorización del supervisor (`autorizarEstimacionDestajo`) — ya escribe a `cuentas_por_pagar` y `asientos_contables` correctamente.
- Flujo de OCs y `RegistrarPagoOCDialog`.
- Catálogo contable.

## Resultado esperado

- Pestaña "Destajos" en Cuentas por pagar lista la `CxP-2026-0001` de Nelson Cruz por $2,210 con botón "Registrar pago", encima de la sección actual de Anticipos.
- Balance → 2110 Destajistas por pagar = $2,210.
- Al registrar el pago, se debita la cuenta seleccionada, se cierra/parcializa la CxP y el balance se actualiza automáticamente.