## Objetivo

Que cada categoría de la tabla "Costos por categoría" — y también la fila de "Producción ejercida" — se pueda **expandir/colapsar inline** en la página principal para revelar sus documentos y conceptos, sin tener que abrir un panel lateral.

## Cambios (un solo archivo)

`src/components/estado-resultados/EstadoResultadosModule.tsx`

1. **Eliminar el `<Sheet>` de detalle** y el estado `detalleCat`/`setDetalleCat`. Ya no se necesita panel lateral.

2. **Reemplazar la tabla "Costos por categoría"** por un `Accordion type="multiple"` que renderice un `AccordionItem` por cada una de las 7 categorías más una fila final estática "Total costos".

   - El **header** del item (AccordionTrigger) muestra en una sola línea: nombre de categoría · monto · `% costo` · `% producción` — visualmente equivalente a la fila actual de la tabla (grid de 4 columnas con `tabular-nums`).
   - El **body** (AccordionContent) renderiza el componente existente `DocumentosLista` con `semana.detalle[cat]`, que ya sabe pintar acordeones de segundo nivel (documento → conceptos) cuando hay `conceptos`, o lista plana cuando no.
   - Si la categoría tiene `monto === 0`, deshabilitar el trigger (no expandible) y mostrar "—".

3. **Añadir bloque "Producción ejercida" como acordeón hermano** justo arriba o abajo de las categorías de costo, con el mismo patrón: header con monto, body con `DocumentosLista docs={semana.produccion_detalle}`.

4. **Tarjetas resumen superiores**: dejarlas como están pero quitar el `onClick` de la tarjeta de Producción (ya no abre Sheet — el detalle vive abajo en el acordeón).

5. **Sin cambios** en:
   - Backend (`estado-resultados.functions.ts`) — ya entrega `conceptos`.
   - Sub-componentes `DocumentosLista`, `DocumentoFlat`, `ConceptosTabla` — se reutilizan tal cual.
   - Tarjetas resumen, histórico de 8 semanas, acumulado.

## Resultado esperado

La página muestra de un vistazo todas las categorías con su monto, y el usuario puede abrir/cerrar cada una para ver sus documentos y, dentro de cada documento, sus conceptos — todo sin navegar a un panel lateral. Soporta múltiples categorías abiertas al mismo tiempo (`type="multiple"`).
