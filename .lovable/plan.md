# Cambio

Eliminar la leyenda `Partida — suma de sus conceptos` que se muestra debajo del campo Concepto en las filas padre. El color de fondo distintivo (`bg-accent/40 font-medium`) y el bloqueo de Unidad/Cantidad/PU (mostrando "—") son suficientes para identificar visualmente las partidas.

# Archivos a modificar

Quitar el bloque `{esPadre && errs.length === 0 && (<p>Partida — suma de sus conceptos</p>)}` (o equivalente) en:

- `src/components/presupuesto/CapturaPresupuestoSheet.tsx`
- `src/components/presupuesto/CapturaOrdenCambioSheet.tsx`
- `src/components/subcontratos/CapturaSubcontratoSheet.tsx`
- `src/components/subcontratos/CapturaOrdenCambioSubcontratoSheet.tsx`
- `src/components/destajos/CapturaDestajoSheet.tsx`
- `src/components/destajos/CapturaOrdenCambioDestajoSheet.tsx`

Sin otros cambios: la detección de padres, el resaltado de fila y el bloqueo de inputs se mantienen.
