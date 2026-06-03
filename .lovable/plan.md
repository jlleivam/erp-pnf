## Objetivo

Mostrar **Semana** y **Global** lado a lado en el panel "Resultado" del dashboard, en dos columnas, eliminando el toggle.

## Cambios

Archivo único: `src/routes/_authenticated/app.obras.$obraId.index.tsx`.

### 1. `ObraDashboard`
- Quitar `useState` de `modoER`.
- Ambas queries (`semana` y `acumulado`) siempre `enabled` (sin condición).
- Pasar a `PanelEstadoResultados`: `dataSemana`, `dataAcumulado`, `boundaries`, `isLoading` combinado (`semana.isLoading || acumulado.isLoading`).
- Eliminar imports de `ToggleGroup`/`ToggleGroupItem` (ya no se usan aquí).

### 2. `PanelEstadoResultados`
- Nueva firma: `obraId`, `inicio`, `dataSemana`, `dataAcumulado`, `boundaries`, `isLoading`.
- Header línea 1: ícono + label fijo "Resultado" (sin toggle a la derecha).
- Cuerpo en grid de 2 columnas (`grid grid-cols-2 gap-4`), cada columna con:
  - **Columna izquierda — Semana**
    - Título pequeño muted: `Semana N · {rango}` (con `numeroSemanaObra` + `rangoSemanaObra`); fallback al rango simple si no hay boundaries.
    - Producción / Gasto / Utilidad o Pérdida con margen (mismo layout actual, tipografía un poco más compacta para que quepa en columna).
  - **Columna derecha — Global**
    - Título pequeño muted: "Acumulado · Desde inicio hasta hoy".
    - Mismos campos (Producción / Gasto / Utilidad o Pérdida con margen).
- Separador vertical sutil entre columnas (`border-l border-border` en la columna derecha, con `pl-4`).
- Botón "Ver detalle" debajo, ancho completo, sin cambios.
- Skeleton: dos columnas de skeletons en paralelo cuando `isLoading`.

### 3. Responsive
- En móvil (`< sm`) las columnas colapsan a una sola (`grid-cols-1 sm:grid-cols-2`) para no apretar el contenido.

## Notas técnicas

- No requiere cambios en backend ni en `EstadoResultadosModule`.
- El cálculo de "Semana N" sigue usando `numeroSemanaObra(boundaries.fechaInicio, inicio)`.
- Tipografía sugerida por columna: Producción/Gasto en `text-base font-semibold`, Resultado en `text-xl font-bold` (en lugar de `text-lg`/`text-2xl` actuales) para evitar wrap en pantallas medianas.
