## Diagnóstico

Hoy `1120 Caja chica` se calcula como `sum(monto_entregado)` de los fondos en estatus `entregado`. Es estático: nunca refleja que el residente ya gastó parte de ese efectivo. Por eso después de aprobar y reponer un reembolso, la cuenta 1120 sigue igual.

El usuario quiere que 1120 represente el **efectivo realmente disponible del residente**: el fondo entregado minus lo que ya gastó y aún no le ha sido repuesto.

## Modelo

Para cada residente con fondo entregado:

```
1120 = monto_entregado
       − Σ gastos aprobados pendientes de reposición
```

Operativamente, "gastos aprobados pendientes de reposición" = `monto_aprobado` de los reembolsos en estatus `enviado_admin` (el supervisor ya aprobó, el admin aún no repone).

Ciclo:
1. Residente recibe fondo (estatus `entregado`): 1120 = 3,000.
2. Residente gasta $180 → supervisor aprueba el reembolso (`enviado_admin`): 1120 baja a 2,820, 2160 sube a 180.
3. Admin repone: el reembolso pasa a `repuesto`, sale de `enviado_admin` → 1120 vuelve a 3,000, 2160 baja a 0, 1110 baja $180.

El balance sigue cuadrando porque el descuento de 1120 se compensa con el alta de 2160 (que ya existía).

## Cambio

### `src/lib/contabilidad/balance.functions.ts`

1. Cambiar la query `cajaChicaReembRes` para seleccionar también `residente_id` (sigue filtrando por `estatus = enviado_admin`).
2. Reescribir el cálculo de `cajaChica`:
   ```ts
   const reembPendientes = sum(cajaChicaReembRes.data, "monto_aprobado");
   const cajaChica = Math.max(0, sum(cajaChicaRes.data, "monto_entregado") - reembPendientes);
   ```
3. En el detalle (`case "1120"` dentro de `buildDetalle`):
   - Cargar también los reembolsos `enviado_admin` (campos: `residente_id`, `monto_aprobado`).
   - Para cada fondo, restar la suma de reembolsos pendientes de ese mismo `residente_id`.
   - Excluir filas cuyo saldo resultante sea ≤ 0.
   - Etiqueta: nombre del residente (igual); referencia: obra.

Sin cambios en otras cuentas ni en el flujo de reposición — al pasar el reembolso de `enviado_admin` a `repuesto`, automáticamente sale del set considerado y 1120 vuelve a su valor anterior.
