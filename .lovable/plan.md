# Arreglar embeds de requisiciones dentro de la obra

## Problema

Dentro de la obra, en el módulo Requisiciones, no aparece la requisición recién creada. La causa es la misma que ya corregimos en la vista global: el servidor llama a `listRequisiciones` con embeds anidados:

```ts
.select(
  "id, folio, estatus, notas, created_at, creado_por, " +
  "items:requisicion_insumos(id, cantidad, fecha_requerida, nota, " +
  "insumo:insumos(id, nombre, unidad))"
)
```

PostgREST necesita foreign keys reales para resolver embeds. En este schema **ninguna** tabla del módulo declara FKs (`requisicion_insumos.requisicion_id`, `requisicion_insumos.insumo_id`, `requisiciones.obra_id`, `requisiciones.company_id`, etc.), así que el query falla y la UI muestra "Sin requisiciones activas". `getRequisicion` (detalle) tiene el mismo problema.

## Fix: agregar las foreign keys que faltan

Una sola migración que añade las FKs naturales del dominio. Sin cambios de RLS, sin cambios de código frontend. Con esto los embeds de PostgREST funcionan en todos los servers fns existentes.

```sql
-- requisiciones
ALTER TABLE public.requisiciones
  ADD CONSTRAINT requisiciones_obra_id_fkey
    FOREIGN KEY (obra_id) REFERENCES public.obras(id) ON DELETE CASCADE,
  ADD CONSTRAINT requisiciones_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- requisicion_insumos
ALTER TABLE public.requisicion_insumos
  ADD CONSTRAINT requisicion_insumos_requisicion_id_fkey
    FOREIGN KEY (requisicion_id) REFERENCES public.requisiciones(id) ON DELETE CASCADE,
  ADD CONSTRAINT requisicion_insumos_insumo_id_fkey
    FOREIGN KEY (insumo_id) REFERENCES public.insumos(id) ON DELETE RESTRICT;
```

Solo se agregan FKs en relaciones donde ya hay datos consistentes (la requisición existente apunta a una obra y company válidas). El alcance se limita al módulo de requisiciones para no tocar otras áreas.

Una vez aplicada la migración:

- En la obra: `listRequisiciones` resuelve `items` + `insumo` y muestra la requisición.
- Detalle: `getRequisicion` resuelve el mismo embed.
- Vista global `/app/admin/requisiciones`: sigue funcionando con el fetch separado que ya implementamos.

## Verificación

1. Entrar a la obra Asfalto Larmex → tab Requisiciones → debe aparecer `REQ-2026-001` con sus insumos.
2. Click en la requisición → detalle muestra cantidades, unidad y nombres de insumos.
3. `/app/admin/requisiciones` sigue mostrando la misma fila.
