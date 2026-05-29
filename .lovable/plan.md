# Arreglar el módulo global de Requisiciones

## Problema

La requisición `REQ-2026-001` existe y pertenece a una obra del usuario, pero la vista `/app/admin/requisiciones` no la muestra.

`listRequisicionesAsignadas` en `src/lib/api/requisiciones.functions.ts` hace:

```ts
.select("..., obra:obras(id, nombre), items:requisicion_insumos(id)")
```

La tabla `requisiciones` **no tiene foreign key** hacia `obras` (ninguna tabla del proyecto declara FKs), así que PostgREST no puede resolver el embed `obra:obras(...)` y el query devuelve error. La query falla y la UI termina sin filas.

## Fix (solo frontend / server fn, sin migración)

Editar `src/lib/api/requisiciones.functions.ts` → `listRequisicionesAsignadas`:

1. Quitar el embed `obra:obras(id, nombre)` del `select`. Dejarlo como:
   ```ts
   .select("id, folio, estatus, notas, enviada_at, created_at, creado_por, obra_id, items:requisicion_insumos(id)")
   ```
2. Después de traer `rows`, hacer una segunda consulta para resolver las obras:
   ```ts
   const obraIdsRows = Array.from(new Set((rows ?? []).map((r:any) => r.obra_id).filter(Boolean)));
   const obraMap = new Map<string,{id:string;nombre:string}>();
   if (obraIdsRows.length) {
     const { data: obs } = await supabase
       .from("obras").select("id, nombre").in("id", obraIdsRows);
     for (const o of obs ?? []) obraMap.set(o.id, o);
   }
   ```
3. En el `return`, sustituir `obra: r.obra` por `obra: obraMap.get(r.obra_id) ?? null`.

No cambia el contrato hacia el componente `AdminRequisicionesPage` (sigue recibiendo `obra: { id, nombre } | null`), así que el resto del archivo no se toca.

## Verificación

- Recargar `/app/admin/requisiciones` → debe aparecer `REQ-2026-001` con su obra y solicitante.
- Filtro por obra y tab Historial siguen funcionando porque dependen del mismo shape.
