## Módulo: Estado de resultados (por obra)

Nueva pestaña dentro de cada obra (`/app/obras/:obraId/estado-resultados`) que muestra, semana por semana, **Producción – Costos = Resultado** y permite identificar si la obra ganó o perdió.

### UI

Layout simple, una sola vista:

1. **Header** con selector de semana (default: semana actual ISO lun–dom) + navegación « semana anterior / siguiente », más rango visible.
2. **Tres tarjetas resumen** arriba:
   - Producción ejercida (verde)
   - Costos totales (rojo)
   - Resultado de la semana (verde/rojo según signo) + margen %
3. **Tabla de costos por categoría** con columnas: Categoría · Monto · % del costo · % de la producción. Click en la categoría abre un sheet con el detalle (lista de documentos que componen el monto, con link a su módulo).
4. **Mini-gráfica** de barras de las últimas 8 semanas (producción vs costos) y línea de resultado acumulado de la obra.
5. Tabla final **Acumulado de la obra**: producción acumulada, costo acumulado, resultado acumulado (desde el inicio hasta la semana visible).

### Fuentes y reglas de cálculo (semana ISO lun–dom)

Todas las fuentes se filtran por `obra_id` y se asignan a la semana ISO que contiene su fecha relevante.

**Producción ejercida** — de `obra_estimaciones` + `obra_estimacion_renglones` (incluye borradores). Para cada semana se toma la estimación cuyo `semana_inicio` cae en esa semana ISO y se suma `importe_ejecutado` de sus renglones. Si no existe estimación, producción = 0.

**Costos** (incluye borradores/pendientes; se etiquetan como "en proceso" en el detalle):

| Categoría | Fuente | Fecha que define la semana | Monto |
|---|---|---|---|
| Almacén (consumido) | `almacen_semanas` + `almacen_movimientos_semana` | `semana_inicio` de la semana | `Σ utilizado * precio_unitario` |
| Nómina | `obra_nominas` + renglones | `semana_inicio` de la nómina | `Σ importe_total` de renglones |
| Destajos | `obra_destajo_estimaciones` | `semana_inicio` de la estimación | `monto_total` |
| Subcontratos | `obra_subcontrato_estimaciones` | `semana_inicio` de la estimación | `monto_total` |
| Rentas | `obra_rentas` | prorrateo por días activos en la semana (entre `fecha_llegada_real`/`fecha_estimada_inicio` y `fecha_devolucion_real`/hoy) según `tarifa_unitaria` y `periodicidad` | `tarifa_diaria * días en la semana` |
| Gasolinas | `vales_gasolina` con `obra_id` | `autorizado_at` (fallback `solicitado_at`) | `monto_autorizado` o `monto_solicitado` |
| Caja chica | `caja_chica_gastos` | `fecha` del gasto | `monto` (todos los estatus excepto `rechazado`) |

Rentas: si `periodicidad = mensual`, tarifa_diaria = tarifa/30; si `semanal`, /7; si `diaria`, igual. Se prorratea proporcional a los días de la renta activos dentro de la semana ISO.

### Backend

Nuevo archivo `src/lib/api/estado-resultados.functions.ts` con dos server functions, ambas con `requireSupabaseAuth`:

- `getEstadoResultadosSemana({ obraId, semanaInicio })` → devuelve `{ produccion, costos: { almacen, nomina, destajos, subcontratos, rentas, gasolinas, cajaChica }, total_costos, resultado, margen, detalle: { [categoria]: Documento[] } }`.
- `getEstadoResultadosHistorico({ obraId, semanas = 8 })` → devuelve array de `{ semana_inicio, semana_fin, produccion, costos_total, resultado }` para la mini-gráfica y el acumulado.

Ambas hacen las consultas en paralelo (Promise.all) por categoría, validan que el usuario es director o miembro de la obra (las RLS ya cubren acceso), y reutilizan `calcularSemana` de `src/lib/estimacion-utils.ts`.

### Frontend

- `src/routes/_authenticated/app.obras.$obraId.$.tsx` — agregar el slug `estado-resultados` y renderizar `<EstadoResultadosModule obraId={obraId} />`.
- `src/components/ObraShell.tsx` — añadir entrada al nav lateral "Estado de resultados" (icono `LineChart` de lucide).
- `src/components/estado-resultados/EstadoResultadosModule.tsx` — orquesta header + tarjetas + tabla + gráfica usando `useQuery` con las dos server functions.
- `src/components/estado-resultados/CategoriaDetalleSheet.tsx` — sheet con el detalle por categoría (lista de documentos con monto y link al módulo origen).
- Gráfica con Recharts (ya disponible en `src/components/ui/chart.tsx`).

### Fuera de alcance

- Panel administrativo consolidado (decidiste "solo por obra"; se puede agregar después).
- Edición/captura de datos: el módulo es 100 % lectura/agregación, no escribe en ninguna tabla.
- Filtros avanzados (por categoría, comparativa vs presupuesto). Se puede iterar después.
- No se crean tablas nuevas ni migraciones; todo se calcula al vuelo desde las tablas existentes.
