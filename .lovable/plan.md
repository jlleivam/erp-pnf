En `src/components/insumos/CatalogoInsumosModule.tsx`, eliminar el bloque de métricas (líneas 150–160) que contiene las 4 tarjetas:
- Total insumos
- Categorías
- Con historial
- Pendientes

Esto implica eliminar tanto el `<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">` como su contenido (4 llamadas a `MetricCard`).

La función `MetricCard` se mantiene ya que podría usarse en otras partes, pero al verificar que no hay otras referencias, también se podría eliminar para limpieza.