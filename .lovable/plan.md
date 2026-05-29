## Objetivo

Reestructurar la tabla comparativa para que cada proveedor ocupe **3 columnas** en lugar de una sola: Cant. cotizada, P.U. e Importe.

## Cambios

**`src/components/requisiciones/ComparativaTable.tsx`**

1. Encabezado en dos filas:
   - Fila 1: `Insumo` (rowSpan 2), `Cant. requerida` (rowSpan 2), y un `TableHead` por proveedor con `colSpan={3}` mostrando razón social + folio, con borde izquierdo para separar grupos.
   - Fila 2: por cada proveedor, 3 `TableHead` pequeños: `Cant.`, `P.U.`, `Importe`.

2. Cuerpo: por cada insumo y por cada proveedor renderizar 3 celdas:
   - **Cant.**: cantidad cotizada. Si `< requerida` → texto ámbar; si `> requerida` → texto azul; igual → normal. Si el proveedor no ofertó ese insumo o lo marcó no disponible → "—".
   - **P.U.**: precio unitario formateado en MXN. Resaltar con fondo esmeralda si es el mínimo entre los disponibles para ese insumo.
   - **Importe**: `cantidad * precio_unitario` en MXN.
   - Borde izquierdo en la primera columna de cada grupo de proveedor para separación visual.

3. Footer: mantener "Total ofertado" por proveedor; ahora el total ocupa `colSpan={3}` bajo cada grupo de proveedor (alineado a la derecha en la columna de Importe).

4. Quitar el `Badge` "No disponible" — con celdas vacías y "—" en las 3 columnas queda claro.

5. Sin cambios de backend ni de otros componentes.
