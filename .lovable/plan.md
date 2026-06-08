## Problema

Cuando un usuario con rol **administrativo** entra a una obra y abre el módulo de Requisiciones, ve la vista del residente (tarjetas, sin acción "Cotizar") y un botón "Nueva". Debería ver la vista administrativa (tabla con columna Acción → Cotizar / Continuar / Ver OCs) pero filtrada únicamente a esa obra, y sin poder crear requisiciones nuevas.

## Cambios

### 1. `src/components/requisiciones/RequisicionesModule.tsx`

- Detectar si el usuario es **administrativo** (o director actuando como administrativo) usando `useEffectiveRoles()`.
- Quitar `"administrativo"` de la lista `puedeCrear` → el botón "Nueva" desaparece para administrativos. Residente, PM, auxiliar y director siguen pudiendo crear.
- Cuando el usuario es administrativo (no residente), renderizar la **misma tabla** que `app.admin.requisiciones.tsx`: columnas Folio, Solicitante, # insumos, Fecha más próxima, Estatus, Acción (Cotizar / Continuar / Ver OCs vía `CotizacionSheet`). Se omite la columna "Obra" porque ya estamos dentro de una obra.
- Para esa tabla se reutilizan los componentes internos `FechaProximaCell` y `AccionCell` — los moveré a un archivo compartido `src/components/requisiciones/AdminRequisicionesTable.tsx` para evitar duplicación, y tanto `RequisicionesModule` como `app.admin.requisiciones.tsx` lo consumirán.
- El listado sigue usando `listRequisiciones({ obraId })` (ya filtra por obra); solo cambia la presentación.
- Residentes/PM/auxiliares conservan la vista de tarjetas compactas/expandibles actual.

### 2. `src/routes/_authenticated/app.admin.requisiciones.tsx`

- Refactor menor: usar el componente compartido `AdminRequisicionesTable` para no duplicar `FechaProximaCell` / `AccionCell` / la estructura de tabla.

## Notas

- No se tocan permisos a nivel server (las server fns ya validan acceso por obra).
- No se cambia el flujo de director: director sigue viendo tarjetas + botón Nueva en la obra (es la vista de operación). Si en el futuro quieres que el director también vea la tabla admin dentro de la obra, se puede agregar un toggle.
- El sub-sheet `CotizacionSheet` ya existe y maneja Cotizar/Continuar/Ver OCs.

## Pregunta abierta

¿El **director** dentro de una obra debe seguir viendo la vista de tarjetas (como hoy), o también prefieres que vea la tabla administrativa cuando entra desde "Vista: Administrativo"? Por defecto dejo la vista actual del director sin cambios y solo activo la tabla admin para el rol `administrativo`.
