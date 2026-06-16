## Cambio

El administrativo ya no puede crear solicitudes de renta. Las solicitudes son responsabilidad del **residente** de la obra. Por consistencia con almacén, también permitimos al **director** y al **supervisor** crear solicitudes (mismo patrón "escritura operativa"). El administrativo conserva su rol de **cotizar**.

## Backend — `src/lib/api/rentas.functions.ts`

En `crearSolicitudRenta` (líneas 151-157), reemplazar el chequeo actual:

```ts
if (!isDirector && !isSupervisor && !isAdministrativo && !member) {
  throw new Error("No tienes permisos en esta obra");
}
```

por una validación que excluya al administrativo puro:

- Permitido si `isDirector`.
- Permitido si el usuario es miembro de `obra_team` con rol `residente` o `supervisor`.
- Cualquier otro caso (incluido administrativo sin rol de obra) → `"Solo el residente, supervisor o director puede crear solicitudes de renta"`.

Para esto se consulta `obra_team.role` (ya hay un patrón equivalente en `almacen.functions.ts` con `assertPuedeEditarAlmacen`). No se toca cotización, autorización, llegada, eventos ni pagos.

## UI — `src/components/rentas/RentasModule.tsx`

- Reemplazar la lectura `useEffectiveRoles` / `useEffectiveIsDirector` por `useObraRole(obraId)` (mismo hook que ya usa almacén) para obtener `isResidente`, `isSupervisor`, `isDirector`, `isAdministrativo`.
- Calcular `puedeSolicitar = isDirector || isSupervisor || isResidente`.
- Mostrar el botón "Nueva solicitud" solo cuando `puedeSolicitar`.
- Mantener `canCotizar = isDirector || isAdministrativo` y `canAuthorize = isDirector || isSupervisor` para `RentaDetalleSheet` (sin cambios funcionales más allá de la fuente del rol).
- El botón eliminar (borrador) sigue solo para director.

## Archivos a tocar

- `src/lib/api/rentas.functions.ts`
- `src/components/rentas/RentasModule.tsx`

## Fuera de alcance

- `NuevaRentaDialog.tsx`: sin cambios (ya no es alcanzable por administrativo desde la UI, y el backend lo bloquea).
- Resto del flujo de rentas (cotizar, autorizar, llegada, renovar, devolver, eventos, pagos): sin cambios.
