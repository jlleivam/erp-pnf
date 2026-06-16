## Problema

En `src/lib/api/estado-resultados.functions.ts`, la consulta de rentas usa:

```ts
.not("estatus", "in", "(borrador,rechazada,cancelada)")
```

Pero el enum `renta_estatus` en la base de datos solo tiene: `borrador, cotizada, autorizada, rechazada, activa, devuelta`. **No existe el valor `cancelada`**.

Esto hace que PostgREST devuelva un error (`invalid input value for enum renta_estatus: "cancelada"`), por lo que `rentasRes.data` queda vacío y el renglón de Rentas en el Estado de Resultados siempre aparece en $0, aunque la renta esté activa y ya tenga días devengados.

## Solución

Eliminar `cancelada` del filtro en `estado-resultados.functions.ts`:

```ts
.not("estatus", "in", "(borrador,rechazada)")
```

Es un cambio de una sola línea. Una vez aplicado, las rentas activas/devueltas se incluirán y el prorrateo diario (`tarifa / días_periodo × días_overlap`) llenará el renglón de Rentas en la semana y en el acumulado.

## Fuera de alcance

- No se modifica la lógica de prorrateo ni los asientos contables diarios (ya implementados).
- No se toca el enum (no hay necesidad de agregar `cancelada`).
