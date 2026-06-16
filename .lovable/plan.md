## Problema

En `src/lib/api/estado-resultados.functions.ts`, el prorrateo de rentas calcula el overlap con la semana usando:

```ts
const fin = r.fecha_devolucion_real ?? r.fecha_fin_programada ?? hoyISO;
```

Eso suma como costo todos los días desde la llegada hasta el fin programado, incluyendo días futuros. Por eso hoy (1er día) reporta $1,714.29 (6 días Lun-Sáb) en vez de $285.71.

## Solución

Cambiar `fin` para que tope en hoy mientras la renta sigue activa:

```ts
const finReal = r.fecha_devolucion_real ?? hoyISO; // si sigue activa, hasta hoy
const fin = finReal < hoyISO ? finReal : hoyISO;
```

Equivalente más simple: `const fin = r.fecha_devolucion_real ?? hoyISO;` (ignoramos `fecha_fin_programada` para devengo; solo cuenta lo ya transcurrido).

Así:
- Día 1 (hoy = llegada): overlap = 1 → $285.71
- Día 2: overlap = 2 → $571.42
- …hasta que se registre devolución, donde el fin queda fijo.

## Fuera de alcance

- No se toca la función SQL `devengar_asientos_renta` — ya devenga solo hasta `LEAST(hoy, fecha_devolucion_real)`, lo cual es consistente.
- No se modifica la lógica de períodos / CxP.
