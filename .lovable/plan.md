# Tooltip en el concepto truncado del `ConceptoPicker`

En la lista del selector de conceptos (botón "Seleccionar concepto…" dentro de la captura de OC) el concepto se trunca con `…` y no hay manera de ver el texto completo.

## Cambio

En `src/components/presupuesto/CapturaOrdenCambioSheet.tsx`, dentro del componente `ConceptoPicker`:

- Envolver el `<span className="flex-1 truncate">{h.concepto}</span>` con `Tooltip` (de `@/components/ui/tooltip`) que muestre el concepto completo al pasar el cursor / al hacer focus.
- Envolver la lista en un único `TooltipProvider delayDuration={200}` para no repetirlo por fila.
- Importar `Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger`.

Sin cambios en datos ni en el resto del flujo.
