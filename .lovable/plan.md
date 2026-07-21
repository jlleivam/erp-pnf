## Objetivo

Que cada renglón de la tabla de proveedores/contratistas ocupe una sola línea, sin scroll horizontal, en el ancho actual del catálogo.

## Cambios en `src/components/terceros/CatalogoTerceroModule.tsx`

1. Aplicar `whitespace-nowrap` a todas las celdas de datos y headers para forzar una sola línea. Los headers actuales ("Nombre / Razón social", "Días crédito", "Vencido o faltante") se están rompiendo en dos renglones.
2. Nombre / Razón social: envolver el texto en `TruncatedCell` (`src/components/pagos/TruncatedCell.tsx`) para que el texto largo se corte con `…` y muestre tooltip. Es la única columna que puede crecer arbitrariamente.
3. RFC, Tipo, Categoría, Días crédito: `whitespace-nowrap`, ancho automático (contenido corto y fijo).
4. Documentos: acortar la etiqueta "Vencido o faltante" a "Faltante" en el badge para que quepa en una línea (el color rojo ya comunica el problema); dejar los otros dos como están ("Al día", "Por vencer"). El label largo original queda disponible en `title` del badge para tooltip nativo.
5. Acciones: quitar `w-32` y usar `w-auto whitespace-nowrap`; los dos iconos ocupan ~72 px.
6. Encabezado de columnas: agregar `whitespace-nowrap` y renombrar "Nombre / Razón social" → "Nombre" para ahorrar ancho sin perder claridad (el subtítulo del módulo ya explica el contexto).
7. No se agrega `overflow-x-auto` en la Card — se mantiene el ancho actual y las celdas se ajustan solas.

## Fuera de alcance

- No se cambia el ancho del contenedor ni el diseño de filtros.
- No se tocan datos ni el detalle del proveedor.