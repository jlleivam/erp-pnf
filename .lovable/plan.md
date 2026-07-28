# Implementar permisos por rol en Requisiciones

Reemplazar los checks basados en rol crudo (`roles.includes("supervisor")`, `isDirector(roles)`, `isAdministrativo`) por los checks del catálogo de permisos (`requisiciones.crear`, `requisiciones.aprobar`, `requisiciones.rechazar`) tanto en UI como en servidor.

## Acciones del catálogo (ya existentes)
- `requisiciones.crear` — mostrar botón "Nueva requisición" y permitir enviar.
- `requisiciones.aprobar` — mostrar botón "Autorizar OC" en la comparativa.
- `requisiciones.rechazar` — mostrar botón "Rechazar OC" en la comparativa.

No se agregan acciones nuevas; se cablean las que ya están en `CATALOGO_ACCIONES`.

## Cambios en cliente (visibilidad de botones)

1. `src/components/requisiciones/RequisicionesModule.tsx`
   - `puedeCrear = can("requisiciones.crear")` (reemplaza el cálculo actual con `isAdministrativo` + roles hardcoded).
   - `puedeRevisar = can("requisiciones.aprobar") || can("requisiciones.rechazar")` para el botón "Revisar / Autorizar" de renglones `pendiente_autorizacion`.

2. `src/components/requisiciones/NuevaRequisicionSheet.tsx`
   - Bloquear submit si `!can("requisiciones.crear")`.
   - Quitar `isDirector` prop-passing basado en rol; usar permiso para decidir si aparece el botón "Enviar" vs solo "Guardar borrador".

3. `src/components/requisiciones/ComparativaTable.tsx`
   - `puedeAutorizar = can("requisiciones.aprobar")`, `puedeRechazar = can("requisiciones.rechazar")`.
   - Sustituye `isSupervisor` para mostrar/ocultar los botones "Autorizar" y "Rechazar" de la OC en estado `pendiente_autorizacion`.

4. `src/components/requisiciones/CotizacionSheet.tsx`
   - `puedeCancelarOC = can("requisiciones.rechazar")` (o dejar director-only si prefieres; ver "decisión" abajo). Reemplaza `isDirector` directo.

5. `src/routes/_authenticated/app.supervisor.requisiciones.tsx`
   - Gate de la ruta: si `!can("requisiciones.aprobar") && !can("requisiciones.rechazar")` → mostrar `ModulePlaceholder` "Sin acceso" en lugar del listado.
   - Quitar `useEffectiveIsDirector` como bypass y confiar en `can()` (el director ya bypasa por diseño).

6. `src/components/AppShell.tsx`
   - El link del sidebar "Supervisión → Por autorizar" queda visible cuando `can("requisiciones.aprobar") || can("requisiciones.rechazar")` (hoy usa `showSupervisor = director || roles.includes("supervisor")`).

## Cambios en servidor (enforcement, defensa en profundidad)

Agregar `requirePermission(supabase, userId, "<key>")` al inicio de cada handler:

- `src/lib/api/requisiciones.functions.ts`
  - `crearRequisicion` → `requisiciones.crear`
  - `guardarBorradorRequisicion` → `requisiciones.crear`
  - `enviarBorradorRequisicion` → `requisiciones.crear`
  - `cancelarRequisicion` — se conserva el gate existente "solo el creador"; no requiere permiso adicional.

- `src/lib/api/cotizaciones.functions.ts`
  - `autorizarOC` → `requisiciones.aprobar`
  - `rechazarOC` → `requisiciones.rechazar`

## Decisiones tomadas por defecto
- La cancelación de OC desde `CotizacionSheet` se ata a `requisiciones.rechazar` (misma semántica de "no proceder"). Si prefieres una acción separada `oc.cancelar` (ya está en el catálogo), la ato a esa en su lugar — indícalo.
- El director sigue con bypass total (política vigente del sistema).

## Fuera de alcance
- No se toca RLS de `requisiciones` ni `ordenes_compra` (la validación va por permisos aplicativos, igual que en Obras).
- No se refactoriza la lógica de negocio, solo los gates.
- Pruebas E2E de los checks quedan pendientes (fue el plan anterior que descartaste).
