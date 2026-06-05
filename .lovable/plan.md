# Estimación semanal solo sobre la semana activa

## Cambio

En `src/components/estimaciones/EstimacionesModule.tsx`, simplificar `NuevaEstimacionDialog`:

- Eliminar el input de fecha y el estado `fecha`.
- Calcular la semana siempre con `calcularSemana(new Date())` (semana activa Lunes–Domingo).
- Mostrar solo el rango de la semana activa como información.
- Mantener la advertencia de "Ya existe una estimación para esta semana" usando `semanasUsadas`.
- Actualizar el texto descriptivo a algo como: "Se creará la estimación de la semana en curso ({rango})."
- Botón "Continuar" llama `onConfirm(semana.inicio)` directamente.

## Fuera de alcance

- No se toca el servidor ni la lógica de `calcularSemana`/`formatRangoSemana`.
- No se cambian estimaciones existentes ni el flujo de captura.
