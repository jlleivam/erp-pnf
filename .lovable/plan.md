## Objetivo
Integrar la importación por PDF (con extracción vía IA) en la ventana "Presupuesto base", reutilizando la tabla existente para que las partidas extraídas sean revisables y editables antes de guardar.

## Cambios

**`src/components/presupuesto/CapturaPresupuestoSheet.tsx`**
- Importar el server function existente `parsearPdfPresupuesto` (ya implementado en `presupuestos.functions.ts`, usa Gemini).
- Añadir botón "Importar PDF" en el toolbar (junto a "Importar Excel"), con `accept=".pdf"` y su propio estado `parsingPdf`.
- Handler `handleImportarPdf(file)`: convierte a base64, llama a `parsearPdfPresupuesto`, y vuelca los renglones al mismo `setRows(...)` que ya usa el import de Excel — así la tabla existente permite editar clave/concepto/unidad/cantidad/PU antes de "Guardar borrador" o "Guardar y autorizar".
- Mostrar toast con el número de partidas extraídas y mensaje "Revísalos antes de guardar".
- Deshabilitar ambos botones de importación mientras cualquiera esté procesando.
- Si la lista actual ya tiene renglones con datos, pedir confirmación antes de reemplazar (para evitar pérdida accidental).

## Fuera de alcance
- Sin cambios en backend: `parsearPdfPresupuesto` ya existe y devuelve el mismo shape que el parser de Excel.
- Sin cambios en el flujo de guardado/autorización.
