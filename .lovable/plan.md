## Problema

`listObras` devuelve todas las obras de la empresa sin filtrar por participación. Por eso Arturo (residente) ve obras donde no está asignado.

## Regla de visibilidad

- **Director**: ve todas las obras de la empresa.
- **Cualquier otro rol** (incluye administrativo, supervisor, residente, auxiliar): solo ve las obras donde está en `obra_team`.

## Cambio

**`src/lib/api/obras.functions.ts` → `listObras`**:
1. Leer `company_id` del perfil y roles del usuario en `user_roles`.
2. Si es `director`: query actual (todas las obras).
3. Si no: filtrar con `inner join` a `obra_team` por `user_id = context.userId`, usando `.select("..., obra_team!inner(user_id)").eq("obra_team.user_id", userId)`.

No se toca UI ni el catálogo de permisos.
