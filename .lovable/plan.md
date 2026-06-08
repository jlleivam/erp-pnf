## Fase 2 — Pagos de Órdenes de Compra + Saldos por Proveedor

Registrar pagos de OC desde una cuenta (bancaria o caja fuerte), con soporte para pagos parciales y cálculo automático de saldos por proveedor.

### 1. Migración de BD

**Tabla `pagos`** (genérica, polimórfica — sirve para futuras fases)
- `id`, `company_id` (FK), `cuenta_id` (FK `cuentas` ON DELETE RESTRICT, NOT NULL).
- `fecha` (date NOT NULL default today), `monto` (numeric(14,2) > 0).
- `metodo` (`efectivo` | `transferencia` | `cheque`).
- `referencia` (text, null) — # cheque, folio transferencia, etc.
- `concepto` (text), `notas` (text, null).
- `origen_tipo` (`oc` por ahora; preparado para `nomina`, `subcontrato`, `renta`, `destajo`, `gasolina`).
- `origen_id` (uuid NOT NULL).
- `creado_por`, `created_at`.
- Índices: `(origen_tipo, origen_id)`, `(cuenta_id, fecha desc)`, `(company_id, fecha desc)`.

**Validaciones (en server fn, no CHECK):**
- Cuenta `caja_fuerte` → solo `metodo='efectivo'`.
- Cuenta `bancaria` → solo `metodo IN ('transferencia','cheque')`.
- `monto` ≤ saldo pendiente de la OC.
- Cuenta debe estar `activa`.

**Columnas nuevas en `ordenes_compra`:**
- `monto_pagado` (numeric(14,2) NOT NULL default 0) — denormalizado, se actualiza vía server fn.
- `estado_pago` (`pendiente` | `parcial` | `pagado`) — derivado.
- `pagada_at` (timestamp, null) — fecha del pago que completa.

**GRANTs + RLS para `pagos`:**
- GRANT estándar (`authenticated`, `service_role`).
- SELECT: director y administrativo de la company.
- INSERT/UPDATE/DELETE: solo via service_role (server functions con `supabaseAdmin`).

### 2. Server functions

**`src/lib/api/pagos.functions.ts`** (nuevo):
- `registrarPagoOC({ ocId, cuentaId, monto, metodo, referencia?, fecha, notas? })` — director + administrativo. Transacción atómica:
  1. Valida rol, cuenta activa, método vs tipo de cuenta.
  2. Lee OC: `total - monto_pagado = saldo_pendiente`. Valida `monto ≤ saldo_pendiente`.
  3. Inserta `pagos`.
  4. Inserta `cuenta_movimientos` (egreso, `origen='pago'`, `origen_id=pago.id`, concepto = "Pago OC {folio} - {proveedor}").
  5. Actualiza `cuentas.saldo_actual -= monto`.
  6. Actualiza `ordenes_compra.monto_pagado += monto`; recalcula `estado_pago` y `pagada_at`.
  7. Rollback manual si cualquier paso falla.
- `listPagosOC(ocId)` — historial de pagos de una OC.
- `cancelarPago(pagoId)` — solo director. Revierte movimiento, saldo de cuenta y `monto_pagado` de OC.

**`src/lib/api/proveedores.functions.ts`** (nuevo o extender `terceros.functions.ts`):
- `getSaldosProveedores()` — director + administrativo. Devuelve por proveedor (`terceros` tipo proveedor):
  - `total_ordenado` (suma de OC), `total_pagado` (suma de `pagos` con `origen_tipo='oc'`), `saldo_pendiente`, `oc_pendientes_count`, `oc_vencidas_count`.
- `getDetalleSaldoProveedor(terceroId)` — lista de OCs con su `total`, `monto_pagado`, `saldo_pendiente`, `estado_pago`.

### 3. UI

**`src/components/pagos/RegistrarPagoOCDialog.tsx`** (nuevo)
- Select cuenta (solo activas de la company, muestra tipo + saldo actual).
- Método: radio filtrado por tipo de cuenta seleccionada.
- Monto (default = saldo pendiente, validación max).
- Fecha (default hoy).
- Referencia (label cambia según método: "# cheque" / "# transferencia" / "—").
- Notas.
- Muestra saldo pendiente de la OC y saldo de la cuenta seleccionada en vivo.

**Modificar `RequisicionDetalleSheet.tsx` (sección OC):**
- Mostrar `estado_pago` como badge (pendiente / parcial / pagado).
- Mostrar `monto_pagado / total` y saldo pendiente.
- Botón "Registrar pago" (rol director/administrativo, deshabilitado si pagada).
- Tabla de historial de pagos (fecha, cuenta, método, referencia, monto, acción "Cancelar" solo director).

**Nuevo módulo "Saldos por proveedor"** — agregar a `CatalogoTerceroModule` o como tab nueva:
- Tabla: Proveedor | Total ordenado | Pagado | Saldo pendiente | OCs pendientes.
- Click en fila → detalle con lista de OCs y su estado de pago.
- Filtros: solo con saldo > 0, por unidad de negocio.

**Movimientos de cuenta (`CuentaDetalleSheet`):**
- Ya existe el listado. Agregar columna "Documento" que linkea al origen (OC) cuando `origen='pago'`.

### 4. Permisos resumidos

| Acción | Director | Administrativo | Otros |
|---|---|---|---|
| Ver cuentas y movimientos | ✓ | ✓ | ✗ |
| Crear/editar cuentas | ✓ | ✗ | ✗ |
| Registrar pago de OC | ✓ | ✓ | ✗ |
| Cancelar pago | ✓ | ✗ | ✗ |
| Ver saldos de proveedores | ✓ | ✓ | ✗ |

### 5. Fuera de alcance (Fase 2)

- Pagos de nómina, subcontratos, rentas, destajos, gasolinas — misma tabla `pagos`, en Fase 3.
- Traspasos entre cuentas, conciliación, reportes exportables — Fase 5.
- Programación de pagos / vencimientos (módulo "Cuentas por pagar") — Fase 3.
- Anticipos sin OC y notas de crédito — Fase posterior.

### Resumen de archivos

- **Migración BD:** crear `pagos` (+ GRANTs + RLS), agregar columnas a `ordenes_compra`.
- **Nuevo:** `src/lib/api/pagos.functions.ts`.
- **Nuevo o extensión:** `src/lib/api/terceros.functions.ts` con `getSaldosProveedores`, `getDetalleSaldoProveedor`.
- **Nuevo:** `src/components/pagos/RegistrarPagoOCDialog.tsx`.
- **Nuevo:** `src/components/proveedores/SaldosProveedoresTab.tsx` (o integrado a `CatalogoTerceroModule`).
- **Editado:** `src/components/requisiciones/RequisicionDetalleSheet.tsx` (sección OC con badge, historial y botón).
- **Editado:** `src/components/configuracion/CuentasTab.tsx` (link a documento en movimientos de tipo pago).
