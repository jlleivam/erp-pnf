## Cambio solicitado
Alinear todas las columnas de la tabla de captura de estimaciones al centro horizontalmente, excepto:
- El encabezado de la columna **Concepto** sigue centrado.
- El contenido (texto) de la columna **Concepto** se alinea a la **izquierda**.

## Archivo a modificar
- `src/components/estimaciones/CapturaEstimacionSheet.tsx`

## Detalle técnico
- Cambiar `text-left` → `text-center` en todos los `<th>`.
- Cambiar `text-right` → `text-center` en todos los `<th>` numéricos y en sus celdas `<td>` correspondientes.
- En la celda `<td>` del concepto, mantener `text-left` explícito para que el texto truncado aparezca alineado a la izquierda.
- Ajustar el `<Input>` de la columna "Esta semana" de `text-right` a `text-center`.