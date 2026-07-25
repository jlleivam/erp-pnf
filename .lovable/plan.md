## Objetivo
Al presionar "Guardar" en el Sheet de Estimación semanal, cerrar el sheet automáticamente para regresar a la pantalla anterior.

## Cambio
En `src/components/estimaciones/CapturaEstimacionSheet.tsx`, dentro del `onSuccess` de `guardarM` (línea ~119): después de mostrar el toast, invalidar queries y llamar `onSaved?.()`, invocar `onClose()` para cerrar el Sheet.

Se mantiene el comportamiento existente (toast de éxito + refresco de datos), solo se agrega el cierre.