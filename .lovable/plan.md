## Objetivo

Reformatear el diálogo **"Pagar anticipo"** (`RegistrarPagoAnticipoDialog`, usado por administrativo en Cuentas por Pagar) para mostrar arriba los datos de la solicitud, conservando abajo los campos necesarios para registrar el movimiento bancario.

## Cambios visuales

Nuevo orden dentro del diálogo:

1. **Título** → "Pago de anticipo de destajo"
2. **Bloque de solo lectura** (`rounded-md border bg-muted/30 p-3`, filas label/valor):
   - **Destajo** → nombre del destajo
   - **Destajista** → nombre del destajista
   - **Monto total del contrato autorizado** → `formatMXN(montoTotal)` *(referencia)*
   - **% de anticipo autorizado** → `XX.XX%` *(referencia)*
   - **Fecha** → fecha de hoy en es-MX (texto, no editable)
   - **Folio** → folio `AD-YYYY-NNNN` asignado al solicitarse
   - **Monto del anticipo** → `formatMXN(monto)` (destacado)
3. **Notas (opcional)** — Textarea editable (notas del pago, ya existía).
4. Separador.
5. **Sección de pago** (igual que hoy, conservada abajo):
   - Cuenta
   - Método de pago (depende de la cuenta)
   - Fecha del pago (editable; default hoy)
   - # Referencia / folio bancario
6. Footer: Cancelar / Registrar pago.

Se elimina el subtítulo en el header (`Pagar anticipo · Cimbra · Nelson Cruz`) porque la información queda dentro del bloque de datos.

## Datos nuevos a pasar

`RegistrarPagoAnticipoDialog` recibirá props adicionales:
- `destajoNombre: string`
- `destajistaNombre: string`
- `folio: string | null`
- `montoTotalContrato: number` *(monto del presupuesto base autorizado)*
- `anticipoPct: number`

`CuentasPorPagarModule.tsx` las pasa desde la fila `pagar` (ya tiene `destajoNombre` y `destajistaNombre`; se agregan los nuevos campos).

## Server function

`listAnticiposDestajoPendientes` (`src/lib/api/destajos.functions.ts`):
- Agregar `folio` al `select` y al objeto retornado.
- Incluir en el join del destajo: `monto_total` y `anticipo_pct`.
- Retornar `folio`, `montoTotalContrato` y `anticipoPct`.

Si `monto_total` o `anticipo_pct` no están en `obra_destajos`, leerlos de `obra_destajo_presupuestos` (tipo `base`, estatus `autorizado`). Se verificará el esquema antes de implementar y se ajustará la fuente.

## Archivos afectados

- `src/components/pagos/RegistrarPagoAnticipoDialog.tsx` — nuevo encabezado de datos + props.
- `src/components/pagos/CuentasPorPagarModule.tsx` — pasar nuevos campos.
- `src/lib/api/destajos.functions.ts` — incluir `folio`, `montoTotalContrato` y `anticipoPct` en `listAnticiposDestajoPendientes`.

No se cambia el esquema (la columna `folio` y la función `siguiente_folio_anticipo_destajo` ya existen). No se toca la lógica de `pagarAnticipoDestajo`.
