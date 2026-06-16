Restringir la creación/edición de gastos de caja chica a residentes (y director). El administrativo no debe poder crear ni editar gastos en una obra.

## Cambios

### `src/lib/api/caja-chica.functions.ts`
- En `crearGastoCajaChica.handler`: además de la membresía, exigir `ctx.isDirector || isResidenteDeObra(supabase, userId, obraId)`. Si el `obra_team.role` del usuario en esa obra no es `residente` (y no es director), rechazar con "Solo el residente puede registrar gastos de caja chica".
- `actualizarGastoCajaChica` ya valida `residente_id === userId`, pero agregamos un guard equivalente para director (sigue editando si residente; director puede editar borradores).
- `eliminarGastoCajaChica`: mismo guard (solo el residente dueño o director).

### `src/components/caja-chica/CajaChicaModule.tsx`
- Calcular `puedeCrearGasto = scope === "obra" && (director || isResidente)`. Ocultar el botón "Nuevo gasto" y los botones de Editar/Eliminar cuando no aplica.
- Ocultar la pestaña "Mis gastos" para administrativo en scope `obra` (queda en Reembolsos/Fondos). Default `tab` se ajusta a `reembolsos` cuando no puede ver "Mis gastos".

## Fuera de alcance

- No se modifican policies de RLS (la validación queda en server function, suficiente porque toda escritura pasa por ahí).
- Supervisor mantiene su acceso actual (sin botón de crear, ya que no es residente).
