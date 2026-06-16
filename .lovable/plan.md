## Problema

La cuenta **2150** ahora incluye `autorizado`, `entregado` y `confirmado`. El usuario quiere que sólo aparezcan los vales que ya fueron **ligados al código físico y entregados** — es decir, los estados `entregado` y `confirmado`. Un vale `autorizado` todavía no genera el asiento contable ni se ha entregado al residente, así que no debe aparecer en el pasivo.

## Cambio

En `src/lib/contabilidad/balance.functions.ts`, cambiar ambas consultas de `vales_gasolina`:

- Saldo agregado (~línea 115)
- Detalle del 2150 (~línea 471)

De: `.in("estatus", ["autorizado", "entregado", "confirmado"])`
A: `.in("estatus", ["entregado", "confirmado"])`

## Fuera de alcance

- Otras cuentas y flujos no cambian.
