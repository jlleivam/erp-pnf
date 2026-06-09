# Problema

El "Acumulado previo" sale en `—` (vacío) aunque ya existan estimaciones de semanas anteriores. 

Causa: en `src/lib/api/estimaciones.functions.ts` la consulta que arma el acumulado previo aún filtra por `estatus = "cerrada"`. Al haber migrado a derivar el estatus por semana, todas las estimaciones quedan guardadas en la base como `borrador`, por lo que la consulta no encuentra ninguna estimación previa y devuelve `{}`.

# Cambios

**`src/lib/api/estimaciones.functions.ts`** — quitar el filtro `.eq("estatus", "cerrada")` en los dos lugares donde se calcula `acumuladoPrevio`. Una estimación es "previa" simplemente si su `semana_inicio` es anterior a la semana en curso:

1. En `iniciarOEditarEstimacion` (≈ línea 161): cambiar
   ```ts
   .eq("estatus", "cerrada")
   .lt("semana_inicio", semana.inicio);
   ```
   por solo
   ```ts
   .lt("semana_inicio", semana.inicio);
   ```

2. En `guardarRenglonesEstimacion` (≈ línea 221): mismo cambio sobre `est.semana_inicio`.

Adicionalmente, en `guardarRenglonesEstimacion` la guarda
```ts
if (est.estatus !== "borrador") throw new Error("...cerrada...");
```
ya no representa el modelo real (la "cerradura" depende de la semana). Reemplazarla por:
```ts
const semanaActual = calcularSemana(new Date()).inicio;
if (est.semana_inicio !== semanaActual)
  throw new Error("Solo se puede modificar la estimación de la semana vigente");
```
e importar `calcularSemana` desde `@/lib/estimaciones-utils` si no está ya importado.

# Sin cambios

- No se tocan tablas, migraciones, RLS, ni el frontend.
- No se modifica la lógica de validación de excedente (sigue usando el `acumuladoPrevio` recalculado, que ahora sí trae datos).
