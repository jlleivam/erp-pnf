## Problema

Actualmente, en el cierre de estimación de destajo, si el usuario escribe un monto de "Liberar fondo en esta semana" mayor al fondo disponible (retenido acumulado), el sistema lo aceptaba silenciosamente y lo recortaba con `Math.min(...)`. Esto puede confundir al residente: capturó 150, pero solo se liberaron 0 (porque el fondo disponible era 0), y el neto a pagar no coincide con lo que esperaba.

## Cambios

### 1. Validación cliente — `CapturaEstimacionDestajoSheet.tsx`

- Detectar exceso: `excedeLiberacion = Number(liberacionFondo) > fondoDisponible`.
- Aplicar estilo de error al input (`border-destructive`) cuando excede.
- Mostrar mensaje inline debajo del input: *"No puede liberar más de {fondoDisponible}. Fondo disponible insuficiente."*
- En `handleGuardar(true)` (cerrar semana) y al confirmar el diálogo: si excede, mostrar `toast.error` y abortar.
- Deshabilitar el botón "Guardar y cerrar semana" cuando hay exceso.
- Quitar el clamp silencioso `Math.min(..., fondoDisponible)` del cálculo de `computed.liberacion` para que el "Neto a pagar" refleje el valor inválido y el usuario vea que algo está mal (alternativamente, mantener el clamp pero mostrar la advertencia — confirmamos abajo).

### 2. Validación servidor — `destajos.functions.ts` (`cerrarEstimacionDestajo`)

- Reemplazar `Math.min(Number(data.liberacionFondo ?? 0), fondoDisponible)` por:
  - Si `data.liberacionFondo > fondoDisponible + 0.01`: `throw new Error("La liberación de fondo (${...}) excede el fondo disponible (${...})")`.
  - Si está dentro de rango, usar el valor tal cual.
- Esto protege contra usuarios que manipulen el request directamente.

## Archivos afectados

- `src/components/destajos/CapturaEstimacionDestajoSheet.tsx`
- `src/lib/api/destajos.functions.ts`

No requiere migración de DB.
