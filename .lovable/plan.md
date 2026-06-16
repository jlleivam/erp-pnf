## Cambio

En `src/components/estimaciones/CapturaEstimacionSheet.tsx`:

1. Deshabilitar el botón **Guardar** cuando `computed.erroresPorClave.size > 0` (además de `guardarM.isPending`).
2. Agregar un tooltip/texto al lado del badge "X con exceso" o usar el `title` del botón para indicar por qué está deshabilitado.
3. Conservar la guarda existente en `handleGuardar` (toast) como defensa secundaria, y dejar la validación del servidor intacta.

Resultado: si hay aunque sea un concepto con cantidad acumulada > vigente, el usuario no podrá presionar Guardar; debe corregir la cantidad o levantar una OC-P primero.

## Fuera de alcance

- No se modifica la validación del servidor (ya rechaza excesos).
- No se altera el indicador "X con exceso" más allá de complementarlo con el estado del botón.
