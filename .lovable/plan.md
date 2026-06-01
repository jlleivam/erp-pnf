# Plan

Voy a ajustar la lógica de la pestaña **Comparativa** para que, al reabrir la requisición, el botón **Asignar mejor precio en todos** complete los faltantes de insumos parcialmente cubiertos por una OC pendiente.

## Qué voy a cambiar

1. **Corregir la lógica del botón masivo**
   - Hoy el botón omite por completo un insumo si detecta cualquier asignación bloqueada en esa fila.
   - Lo voy a cambiar para que conserve lo ya bloqueado y solo reparta el **faltante** entre los demás proveedores disponibles.

2. **Ajustar el cálculo de “mejor precio” por fila**
   - La función que asigna por precio hoy reconstruye la fila desde cero usando la cantidad total requerida.
   - La voy a adaptar para que:
     - respete las líneas ya bloqueadas,
     - calcule cuánto queda pendiente,
     - asigne ese remanente al proveedor más barato disponible con capacidad suficiente o parcial.

3. **Mantener el comportamiento correcto de bloqueo**
   - Las líneas de la OC pendiente de autorización deben seguir viéndose bloqueadas y no editarse.
   - El cambio solo debe afectar las cantidades no cubiertas todavía.

4. **Validar el caso reportado**
   - Caso esperado después del ajuste:
     - Macro bodega mantiene bloqueados 5 BTO de mortero y 30 BTO de cemento.
     - Al usar **Asignar mejor precio en todos**, se asignan además **20 BTO de mortero** y **20 BTO de cemento** a Construalcalde.
     - Varrilla/aceros alcalde sigue comportándose como ahora.

## Detalle técnico

- Revisaré `src/components/requisiciones/ComparativaTable.tsx`.
- Cambiaré `tomarMejorPrecio` y/o `tomarMejorPrecioTodos` para trabajar con:
  - asignaciones bloqueadas existentes,
  - faltante restante por insumo,
  - proveedores no bloqueados y con oferta válida.
- La reasignación no debe borrar líneas persistidas ni sobrescribir paquetes ya enviados.

## Resultado esperado

Después del cambio, al cerrar y volver a abrir la requisición, el botón **Asignar mejor precio en todos** deberá completar automáticamente los insumos pendientes aunque la fila ya tenga una parte bloqueada por una OC enviada.