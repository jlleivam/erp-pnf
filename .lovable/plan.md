## Problema

El diálogo `AutorizarValeDialog` muestra dos botones "Autorizar":
- Arriba: un toggle de modo (Autorizar / Rechazar) que decide qué campo se ve.
- Abajo: el botón de acción que ejecuta el modo seleccionado.

Resulta confuso.

## Cambio

En `src/components/gasolinas/AutorizarValeDialog.tsx`:

1. Eliminar la fila de toggle superior (`Autorizar` / `Rechazar`).
2. Mostrar siempre el campo **Monto autorizado**. El campo de **Motivo de rechazo** aparece solo cuando se entra en modo rechazo.
3. Footer queda con tres botones: `Cancelar` | `Rechazar` (outline destructive) | `Autorizar` (primary).
   - Click en **Rechazar** la primera vez: cambia `mode` a `"rechazar"`, oculta el monto, muestra el textarea de motivo, y el botón se convierte en `Confirmar rechazo`. Aparece un enlace/botón pequeño "Volver" para regresar a modo autorizar.
   - Click en **Autorizar**: ejecuta la mutación de autorizar con el monto.

Resultado: un solo botón con la palabra "Autorizar" visible a la vez, sin duplicación.

## Fuera de alcance

- No se cambia la lógica del servidor (`autorizarValeGasolina` / `rechazarValeGasolina`).
- No se modifican otros diálogos.
