## Objetivo

Agregar un toggle **Semana / Global** al panel "Resultado semana" del dashboard de la obra, sin navegación entre semanas. La vista Semana muestra los datos de la semana actual (como ya lo hace); la vista Global muestra el acumulado desde el inicio de la obra hasta hoy.

## Cambios

Archivo único: `src/routes/_authenticated/app.obras.$obraId.index.tsx`.

### 1. Imports
- Agregar `getEstadoResultadosAcumulado` y `getObraSemanaBoundaries` a la importación desde `@/lib/api/estado-resultados.functions`.
- Importar `ToggleGroup`, `ToggleGroupItem` de `@/components/ui/toggle-group`.
- Importar `numeroSemanaObra` de `@/lib/estimacion-utils` para etiquetar la semana actual.

### 2. `ObraDashboard`
- Añadir `useState<"semana" | "global">("semana")` para el modo.
- Crear queries adicionales:
  - `acumulado` con `getEstadoResultadosAcumulado`, `enabled: modo === "global"`.
  - `boundaries` con `getObraSemanaBoundaries` (para conocer el número de semana actual y mostrar "Semana N" en el header del panel).
- Pasar `modo`, `onModoChange`, datos de `semana` y `acumulado`, y `boundaries.data` al `PanelEstadoResultados`.

### 3. `PanelEstadoResultados`
- Nueva firma: recibe `modo`, `onModoChange`, `dataSemana`, `dataAcumulado`, `boundaries` (`{ fechaInicio, semanaActual } | undefined`), `isLoading` (combinado según modo).
- Header del panel:
  - Línea 1 conservada: ícono + label que cambia entre "Resultado semana" y "Resultado global".
  - Reemplazar el rango de fecha de la derecha por un `ToggleGroup` pequeño (`size="sm"`, `variant="outline"`) con opciones **Semana** / **Global**.
  - Debajo (o en una segunda línea muted), mostrar:
    - Modo semana: `"Semana N · {rango}"` (N calculado con `numeroSemanaObra(fechaInicio, semanaActual)`; fallback al rango actual si no hay boundaries todavía).
    - Modo global: `"Desde inicio de obra hasta hoy"`.
- Cuerpo: leer del objeto correcto (`dataSemana` o `dataAcumulado`); ambos tienen las mismas keys `produccion`, `costos_total`, `resultado`, `margen`.
- Etiqueta "Producción" y "Gasto" sin cambios; el bloque inferior cambia entre "Utilidad / Pérdida" igual que hoy (la lógica `positivo` usa `resultado`).
- Botón "Ver detalle" sin cambios.

### 4. Sin navegación de semanas
- No agregar flechas ni selector de fecha. La vista semanal queda fija en la semana actual.

## Notas técnicas

- No requiere cambios en backend ni en `EstadoResultadosModule` (el módulo completo ya tiene su propio toggle).
- El cálculo de "Semana N" reutiliza el helper agregado anteriormente; si `boundaries` aún no carga, se muestra solo el rango sin el número.
