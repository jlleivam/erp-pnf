## Normalización de nombre de cuenta contable en pago de anticipo

### Cambio
En `src/lib/api/destajos.functions.ts` (función `pagarAnticipoDestajo`), actualizar el abono del asiento contable cuando el pago sale de caja fuerte:

- Actual: `"Caja"`
- Nuevo: `"Caja fuerte"`

Esto unifica la nomenclatura con el pago de estimaciones (`registrarPagoCxP` en `pagos.functions.ts`), donde el abono a caja fuerte ya se registra como `"Caja fuerte"`.

### Archivo afectado
- `src/lib/api/destajos.functions.ts` (línea ~2119)

### Sin impacto funcional
El balance sigue calculándose desde las tablas fuente; solo cambia el texto del campo `cuenta_contable` en la tabla `asientos_contables` para los anticipos pagados en efectivo.