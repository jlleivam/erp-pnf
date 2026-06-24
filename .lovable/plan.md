## Objetivo
Que cada fila de las tablas en Cuentas por pagar (Proveedores, Destajos, Subcontratos, Gasolinas, Caja chica) se muestre en un solo renglón. Si el texto no cabe, truncar con ellipsis y mostrar el valor completo en un tooltip al pasar el cursor.

## Archivos a modificar
- `src/components/pagos/CuentasPorPagarModule.tsx` — pestañas Proveedores, Destajos, Subcontratos y detalle de proveedor (sheet)
- `src/components/pagos/GasolinasPorPagarTab.tsx` — pestaña Gasolinas
- `src/components/pagos/CajaChicaPorPagarTab.tsx` — pestaña Caja chica

## Enfoque técnico
1. Importar `Tooltip`, `TooltipTrigger`, `TooltipContent` y `TooltipProvider` de `@/components/ui/tooltip` en cada archivo.
2. Crear un componente reutilizable local (por ejemplo `TruncatedCell`) que renderice el texto con `truncate` y lo envuelva en un `Tooltip`. Esto evita repetir el mismo patrón docenas de veces.
3. Aplicar el componente a todas las celdas de texto variables: Folio/Ref, Obra, Destajista/Contratista/Residente, Concepto, Proveedor, Solicitante, Combustible.
4. En las celdas numéricas aplicar `whitespace-nowrap` para evitar saltos de línea.
5. Mantener el scroll horizontal del contenedor cuando el contenido exceda el ancho; no forzar columnas a anchos fijos que rompan el layout actual.
6. Revisar que los encabezados (`TableHead`) también usen `whitespace-nowrap` para mantener alineación visual.

## Resultado esperado
- Ninguna celda de texto hará wrap a dos líneas.
- Texto truncado mostrará tooltip con el valor completo.
- El scroll horizontal seguirá funcionando cuando haya muchas columnas o texto largo.