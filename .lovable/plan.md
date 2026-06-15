## Cambio

Restringir las acciones de **escritura** del almacén a residente, supervisor y director. El administrativo queda en **solo lectura**.

## Acciones afectadas (escritura → residente/supervisor/director)

En `src/lib/api/almacen.functions.ts`:

1. **`registrarRecepcion`** — hoy permite director o residente. Ampliar a: residente, supervisor o director.
2. **`actualizarUtilizado`** — hoy usa `assertObraAccess` (deja pasar también a administrativo). Restringir a residente, supervisor o director.
3. **`bloquearSemana`** — hoy es residente/supervisor. Ampliar para incluir director.
4. **`solicitarDesbloqueoSemana`** — hoy es residente/supervisor. Ampliar para incluir director (un director también puede pedir desbloqueo, aunque normalmente él lo aprueba directo).
5. **`resolverSolicitudDesbloqueo`** — sin cambios: supervisor de la obra o director.

Se centraliza el chequeo en un helper `assertPuedeEditarAlmacen(supabase, userId, obraId, roles)`:
- `roles.includes("director")` → permitido.
- O miembro de la obra con rol `residente` o `supervisor`.
- Cualquier otro caso (incluido `administrativo`) → rechazado con "Solo residente, supervisor o director pueden modificar el almacén".

## Acciones de lectura (sin cambios)

`listOCsPorRecibir`, `getOCParaRecepcion`, `getSemanaActual`, `listHistorialSemanas`, `getSemana`, `listSolicitudesDesbloqueo` siguen usando `assertObraAccess` (director, administrativo, o miembro de obra).

## UI

- `SemanaActualPanel.tsx`: deshabilitar input de "utilizado" y ocultar botones de bloquear/solicitar desbloqueo cuando el usuario no es residente, supervisor ni director. (Ya hay `useObraRole`; agregar `isDirector` al check.)
- `AlmacenModule.tsx` (pestaña "Por recibir"): ocultar el botón "Registrar recepción" cuando el usuario es solo administrativo.

## Archivos a tocar

- `src/lib/api/almacen.functions.ts`
- `src/components/almacen/SemanaActualPanel.tsx`
- `src/components/almacen/AlmacenModule.tsx`
