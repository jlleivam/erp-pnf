## Objetivo

Agregar al módulo **Cuentas por pagar** un apartado de **Gasolinas** que liste los vales ya ligados/entregados (estatus `entregado` o `confirmado`) con saldo pendiente, permita **seleccionar varios con checkboxes** y registrar **un solo pago acumulado** que liquide todos los vales seleccionados.

## Flujo de usuario

1. En `/app/admin/cuentas-por-pagar` aparece una nueva pestaña **Gasolinas** (junto a Proveedores / Destajos / Subcontratos), con badge contador de vales pendientes.
2. La tabla muestra: checkbox · folio · obra · tipo · solicitante · fecha de entrega · monto autorizado · pagado · saldo.
3. Al marcar checkboxes se muestra una barra fija con: **N vales seleccionados · Total $X.XX · [Registrar pago]**.
4. El diálogo muestra el listado resumido (no editable) y pide: cuenta (banco/caja fuerte), método, fecha, referencia (opcional), notas (opcional). El monto total es la suma de los saldos seleccionados.
5. Al guardar: descuenta saldo de la cuenta, registra los pagos en backend y refresca la lista. Los vales pagados desaparecen del listado y del pasivo 2150.

## Cambios técnicos

### `src/lib/api/vales-gasolina.functions.ts`
- **`listValesPorPagar`** (nuevo, GET autenticado, director/administrativo): devuelve vales con `estatus ∈ {entregado, confirmado}` de la empresa, calcula `pagado` (suma de `pagos` con `origen_tipo='gasolina'`, `origen_id=vale.id`, no cancelados) y `saldo`; filtra `saldo > 0.01`. Incluye nombre de obra, solicitante y `ligado_at`.
- **`pagarValesGasolina`** (nuevo, POST autenticado, director/administrativo):
  - Input: `{ cuentaId, fecha, metodo, referencia?, notas?, valeIds: string[] }` (1..50).
  - Valida cuenta (activa, empresa, método vs tipo de cuenta — mismas reglas que `registrarPagoOC`).
  - Lee vales seleccionados; recalcula saldo individual con pagos existentes; rechaza si alguno ya no tiene saldo.
  - Calcula `total = Σ saldos`; valida que no exceda saldo de la cuenta.
  - Genera **un solo `cuenta_movimiento`** por el total con concepto `"Pago vales gasolina (N) · ref"`.
  - Por cada vale inserta:
    - una fila en `pagos` con `origen_tipo='gasolina'`, `origen_id=vale.id`, `monto=saldo_vale`, `cuenta_movimiento_id` compartido, concepto `"Pago vale {folio}"`.
    - dos renglones en `asientos_contables` (cargo a `Cuentas por pagar - Gasolinas`, abono a `Bancos`/`Caja fuerte`) bajo un mismo `asiento_id` por vale.
  - Actualiza `cuentas.saldo_actual` restando el total. Rollback completo si cualquier paso falla.

### `src/components/pagos/CuentasPorPagarModule.tsx`
- Añadir `TabsTrigger value="gasolinas"` con badge contador (usa `listValesPorPagar`).
- Añadir `TabsContent` con el nuevo componente `GasolinasPorPagarTab`.

### `src/components/pagos/GasolinasPorPagarTab.tsx` (nuevo)
- Tabla con `Checkbox` por fila + checkbox maestro en header.
- Estado local `selected: Set<string>`. Barra inferior fija con total seleccionado y botón **Registrar pago** (deshabilitado si no hay selección).
- Card resumen "Saldo total pendiente" arriba a la derecha.
- Filtro de búsqueda por folio / obra / solicitante.

### `src/components/pagos/RegistrarPagoValesGasolinaDialog.tsx` (nuevo)
- Lista resumida de los vales seleccionados (folio · obra · saldo).
- Form: cuenta (select de `cuentas` activas), método (efectivo/transferencia/cheque, restringido por tipo de cuenta), fecha (default hoy), referencia, notas.
- Total en grande, no editable.
- Al `onSaved`: invalida `vales-por-pagar`, `cuentas-activas`, `balance`.

## Fuera de alcance

- No se agrega nuevo estatus `pagado` al enum — el "pagado" se infiere por `saldo == 0`. Esto evita migración y mantiene compatibilidad con el resto del flujo.
- No se modifica el asiento contable que genera `ligarCodigoVale` (sigue siendo el origen del pasivo en 2150).
- No se toca el módulo Gasolinas ni el balance — ya consumen correctamente los pagos con `origen_tipo='gasolina'`.
