## Auto-calcular "Fecha fin programada" al marcar llegada

El diálogo `MarcarLlegadaDialog` actualmente pide la fecha fin a mano. La renta ya tiene la periodicidad sugerida y los periodos estimados que capturó el residente, así que podemos calcularla automáticamente.

### Cambios

**`src/components/rentas/RentaDetalleSheet.tsx`**
Pasar al diálogo los campos ya disponibles en `renta`:
```tsx
<MarcarLlegadaDialog
  rentaId={rentaId}
  periodicidad={renta.periodicidad ?? null}
  periodosEstimados={renta.periodos_estimados ?? null}
  ...
/>
```

**`src/components/rentas/MarcarLlegadaDialog.tsx`**
- Ampliar props con `periodicidad` y `periodosEstimados`.
- Helper `calcFin(llegada, periodicidad, periodos)`: suma `periodos × díasPorPeriodo − 1` a la fecha de llegada (mapa `diaria=1, semanal=7, quincenal=15, mensual=30`).
- En `useEffect` que escucha `llegada`, recalcular `fin` automáticamente — pero sólo si el usuario no lo editó manualmente (flag `finTouched`). Si la renta no tiene periodicidad o periodos, dejar el campo vacío como hoy.
- Marcar el input de fin con `onChange` que sube el flag `finTouched`.
- Mostrar nota tipo "Calculado a partir de la solicitud · podés ajustarlo" debajo del campo cuando viene autocalculado.

### Fuera de alcance
- Cambiar el flujo de cotización (la periodicidad/tarifa del admin no afectan acá: usamos la sugerida del residente, que es la base de la solicitud).
- Server: `marcarLlegada` sigue recibiendo `fechaFinProgramada` tal cual.
