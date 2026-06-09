## Bug: Requisiciones aparecen en Activas y en Historial

### Causa
En `src/lib/api/requisiciones.functions.ts`:
- `soloActivas: true` → excluye `completada`/`rechazada` ✅
- `soloActivas: false` (Historial) → **no aplica ningún filtro**, devuelve TODAS incluyendo las activas ❌

Por eso `REQ-2026-001` (estatus `oc_generada` = activa) aparece tanto en "Activas" como en "Historial".

### Definición correcta
- **Activas**: estatus distinto a `completada` y `rechazada`.
- **Historial**: estatus `completada` o `rechazada` únicamente.

### Cambio
Reemplazar el parámetro booleano por un filtro explícito `scope: "activas" | "historial"` (o, más simple, agregar la rama `else` que filtre a `in (completada, rechazada)` cuando `soloActivas === false`).

Opción mínima elegida: en `listRequisiciones`, cuando `soloActivas` sea `false` **explícitamente**, filtrar `estatus in ('completada','rechazada')`. Si es `undefined`, no filtra (retrocompat).

### Archivos
- `src/lib/api/requisiciones.functions.ts` — agregar rama `else if (data.soloActivas === false)` que aplique `.in("estatus", ["completada","rechazada"])` en ambas funciones (`listRequisiciones` y la admin version línea 79).
- `src/components/requisiciones/RequisicionesModule.tsx` — sin cambios (ya envía `soloActivas:false` para historial).

Sin cambios de UI ni de esquema.
