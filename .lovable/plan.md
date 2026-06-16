## Problema

En `src/lib/contabilidad/balance.functions.ts`, la cuenta **2150 — Vales de gasolina por reembolsar** sólo considera vales con estatus `"autorizado"`. Al ligar el código, el vale avanza a `"entregado"` (y luego a `"confirmado"`), por lo que desaparece del pasivo aunque sí representa una obligación.

## Cambio

Reemplazar las dos consultas `.eq("estatus", "autorizado")` sobre `vales_gasolina` para que usen `.in("estatus", ["autorizado", "entregado", "confirmado"])`:

1. **Saldo agregado** (alrededor de la línea 115): el `select` que alimenta `gasolinaPorReembolsar`.
2. **Detalle del 2150** (alrededor de la línea 471): el `select` que arma la lista expandible.

Con esto, los vales `entregado`/`confirmado` permanecen en el pasivo hasta que se registre el pago correspondiente en `pagos` con `origen_tipo = 'gasolina'`, que ya los descuenta vía la lógica existente.

## Fuera de alcance

- No se modifica la creación del asiento contable (ya implementada).
- No se altera la cuenta 2160 ni otras cuentas.
- No se cambian estados ni flujos de vales.
