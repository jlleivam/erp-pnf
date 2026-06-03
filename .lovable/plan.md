## Vista Global + límite de navegación de semanas en Estado de resultados

### Cambios en backend

**`src/lib/api/estado-resultados.functions.ts`** — añadir 2 server fns:

1. **`getObraSemanaBoundaries({ obraId })`** → `{ primerSemana: string, semanaActual: string }`
   - Lee `obras.fecha_inicio` y `obras.created_at`; usa `fecha_inicio` si existe, si no `created_at` (fallback). La fecha base se normaliza al lunes de su semana con `calcularSemana()`.
   - `semanaActual` = lunes de la semana de hoy.
   - Sirve para limitar el navegador de semanas.

2. **`getEstadoResultadosAcumulado({ obraId })`** → `SemanaDetalle` (mismo shape que `getEstadoResultadosSemana`)
   - Calcula la lista de semanas desde `primerSemana` hasta `semanaActual` (helper interno tipo `semanasEntre(inicio, fin)`).
   - Llama `calcularBuckets(..., withDetail=true)` y agrega: suma `produccion`, suma cada categoría de `costos`, concatena `detalle[cat]` y `produccion_detalle` de todos los buckets. `resultado` y `margen` recalculados a partir del agregado.
   - `semana_inicio` = primerSemana, `semana_fin` = fin de semanaActual.

### Cambios en UI

**`src/components/estado-resultados/EstadoResultadosModule.tsx`**:

- Estado nuevo: `modo: "semana" | "global"` (default `"semana"`).
- Query nueva para boundaries; otra query para `getEstadoResultadosAcumulado` (habilitada sólo cuando `modo === "global"`).
- **Header**:
  - Añadir un `ToggleGroup` (o tabs) `[Semana | Global]` a la izquierda del navegador de semanas.
  - En modo `"semana"`: navegador visible. Botón **anterior** se deshabilita cuando `semanaInicio <= primerSemana`. Botón **siguiente** ya está limitado por `semanaActual`.
  - En modo `"global"`: navegador oculto; en su lugar muestra un texto `Desde {primerSemana} hasta {semanaActual}`.
- **Cuerpo**: las tarjetas resumen y el desglose por categorías ya son agnósticos al rango — se alimentan de la misma estructura `SemanaDetalle`, así que sólo cambia la fuente de datos según el modo.
- **Histórico de 8 semanas**: se mantiene visible en ambos modos (es un gráfico independiente).
- **Card "Acumulado de la obra"** (al final): sólo se muestra en modo `"semana"` (en modo global es redundante).
- Etiquetas dinámicas de las tarjetas: "Producción ejercida" / "Costos totales" / "Resultado" funcionan igual; el subtítulo del header pasa a `"Producción contra costos · {semana | acumulado de la obra}"`.

### Archivos a tocar
- `src/lib/api/estado-resultados.functions.ts` (2 nuevas server fns + helper `semanasEntre`)
- `src/components/estado-resultados/EstadoResultadosModule.tsx` (toggle, queries, render condicional)

Sin migraciones de DB.
