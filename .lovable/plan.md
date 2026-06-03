## Objetivo

Mostrar "Semana N" en el estado de resultados, contando desde la fecha de inicio (o creación) de la obra. La **Semana 1** abarca desde `fecha_inicio` hasta el domingo de esa misma semana ISO (parcial si la obra arrancó en miércoles, jueves, etc.). Las siguientes semanas son completas lunes–domingo.

## Cambios

### 1. Helpers en `src/lib/estimacion-utils.ts`

Agregar dos utilidades puras (no tocan las existentes):

- **`numeroSemanaObra(fechaInicioObra: string, semanaInicio: string): number`**
  Devuelve el índice 1-based de la semana. Se calcula como `floor((semanaInicio_lunes − primerSemana_lunes) / 7 días) + 1`. Para cualquier fecha dentro de la primera semana ISO de la obra, retorna `1`.

- **`rangoSemanaObra(fechaInicioObra: string, semanaInicio: string): string`**
  Igual que `formatRangoSemana`, pero si `semanaInicio` corresponde a la **semana 1** y `fechaInicio` cae después del lunes de esa semana, el rango inicia en `fechaInicio` en vez del lunes (ej.: "05 jun – 08 jun 2026" para una obra que arrancó jueves). Para las demás semanas, comportamiento normal lunes–domingo.

### 2. Backend `src/lib/api/estado-resultados.functions.ts`

- **`getObraSemanaBoundaries`**: incluir también `fechaInicio` (string ISO YYYY-MM-DD) en el retorno, además de `primerSemana` y `semanaActual`. Es la fecha real (no normalizada a lunes) que se usa para mostrar el rango de la semana 1.

### 3. UI `src/components/estado-resultados/EstadoResultadosModule.tsx`

- Importar los nuevos helpers.
- Reemplazar el cálculo de `rango` para combinar número + rango:
  - Modo semana: `"Semana N · {rangoSemanaObra(...)}"`.
  - Modo global: `"Acumulado · Semanas 1–N hasta hoy"`, donde N corresponde a `semanaActual`.
- Subtítulo del header: en modo semana, `"Producción contra costos · Semana N de la obra"`.
- En la card "Acumulado de la obra (hasta esta semana)" del modo semana, agregar el sufijo `"(Semanas 1–N)"`.
- En el histórico de 8 semanas, sustituir el tick del eje X (`s.semana_inicio.slice(5)`) por `"S{N}"` calculado con `numeroSemanaObra`, dejando la fecha completa en el tooltip.

## Notas técnicas

- No se modifica `calcularSemana` (sigue normalizando a lunes–domingo ISO); la numeración es derivada y vive solo en presentación + cómputo.
- No requiere migración: `fecha_inicio` y `created_at` ya se leen en `getObraSemanaBoundaries`.
- Si `fecha_inicio` es nula se usa `created_at` como hoy, igual que ya lo hace el código actual.
