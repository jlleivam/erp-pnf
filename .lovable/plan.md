## Objetivo

Distinguir entre **monto pagado** (lo que se le repone al residente) y **gasto a la obra** (lo que se carga al costo de la obra) según el tipo de comprobante del gasto de caja chica:

| Tipo de comprobante | Reembolso al residente | Gasto a la obra |
|---|---|---|
| Factura | monto total | **base sin IVA** = monto ÷ 1.16 |
| Nota | monto total | **monto total** (no hay IVA acreditable) |
| Sin comprobante (ninguno) | monto total | **monto total** |

El IVA acreditable de la factura sí se paga, pero no es costo de obra — es un activo recuperable.

## Cambios

### `src/lib/api/caja-chica.functions.ts` (helper)
- Agregar y exportar helper puro `montoGastoObra(monto, tipoComprobante)`:
  - `factura` → `+(monto / 1.16).toFixed(2)`
  - resto → `monto` tal cual.
- Usar tasa IVA = 16% en una constante `IVA_RATE = 0.16`.

### `src/lib/api/estado-resultados.functions.ts`
- En el `select` de `caja_chica_gastos` ya viene `tipo_comprobante`. En el bucle de "Caja chica" (~línea 547), reemplazar `const monto = num(g.monto)` por `const monto = montoGastoObra(num(g.monto), g.tipo_comprobante)` para que el costo de obra refleje base sin IVA cuando hay factura.
- En `detalle.cajaChica.meta`, mostrar también el monto total pagado cuando difiera (ej. `"$130.00 con IVA · base $112.07"`).

### UI — mostrar gasto a obra
- `src/components/caja-chica/CajaChicaModule.tsx`: en cada renglón de gasto, debajo del monto total agregar una línea pequeña *"Gasto a obra: $X.XX"* cuando difiera del monto pagado (sólo facturas).
- `src/components/caja-chica/RevisarReembolsoSheet.tsx`: igual, mostrar "Gasto a obra" por gasto y un subtotal de gasto a obra del reembolso completo.
- `src/components/caja-chica/GastoForm.tsx`: al seleccionar tipo de comprobante = factura y haber capturado monto, mostrar una nota de ayuda *"Gasto a obra (sin IVA): $X.XX"* debajo del select.

## Fuera de alcance

- El monto del **reembolso al residente** (`caja_chica_reembolsos.monto_solicitado/aprobado/reembolsado`) y el pasivo en balance NO cambian — siguen siendo el total pagado en efectivo.
- No se crea cuenta separada de "IVA acreditable" en este pase (el flujo contable detallado puede agregarse después si lo requieren).
- No se modifica la estructura de la tabla `caja_chica_gastos`.
