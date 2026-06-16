## Problema

Hoy `getCompanyAndAccess` en `src/lib/api/estimaciones.functions.ts` define:

```ts
canEdit = isDirector || isObraMember
```

`isObraMember` es cualquier registro en `obra_team` para esa obra, así que `administrativo` puede crear/editar/cerrar/eliminar estimaciones. La regla pedida: solo `residente` y `supervisor`.

## Cambios

**1. `src/lib/api/estimaciones.functions.ts` — `getCompanyAndAccess`**

Reemplazar la consulta a `obra_team` para que traiga `role` y construir el flag con base en el rol:

```ts
const { data: team } = await supabase
  .from("obra_team").select("role")
  .eq("obra_id", obraId).eq("user_id", userId).maybeSingle();
const obraRole = team?.role ?? null;
const isEditorObra = obraRole === "residente" || obraRole === "supervisor";
return {
  companyId,
  isDirector,
  isObraMember: !!team,
  obraRole,
  canEdit: isEditorObra, // director ya NO crea/edita estimaciones
};
```

Director queda fuera de `canEdit` para cumplir literalmente con "únicamente residente y supervisor". Esto afecta `crearOActualizarEstimacion`, `cerrarEstimacion` y `eliminarEstimacion` (todas usan el mismo `canEdit`).

**2. `src/components/estimaciones/EstimacionesModule.tsx` — UI**

- Usar `useObraRole(obraId)` y derivar `canEdit = isResidente || isSupervisor`.
- Ocultar el botón **"Nueva estimación"** cuando `!canEdit`.
- Ocultar el botón **"Editar"** cuando `!canEdit`.
- Cambiar la condición del botón eliminar de `director` a `canEdit` (ya no aplica a director). Si `canEdit` es false, no se muestra.
- Mantener "Ver" disponible para todos los miembros de la obra.

No se requiere migración SQL: las políticas RLS de `obra_estimaciones` ya restringen a miembros; el gate fino se aplica en el servidor (server function) que es por donde entran todas las escrituras.

## Fuera de alcance

- No se tocan subcontratos, destajos, ni otros módulos.
- No se modifica el rol `director` para otras secciones.
- No se eliminan estimaciones existentes creadas por administrativos.
