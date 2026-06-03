## Objetivo

Quitar la sección "Módulos de la obra" del dashboard de la obra, ya que es redundante con el menú inferior (móvil) y la barra lateral (desktop).

## Cambio

### `src/routes/_authenticated/app.obras.$obraId.index.tsx`

- Eliminar el bloque `<div>` final que renderiza el título "Módulos de la obra" y el grid con los `MODULES.map(...)`.
- Eliminar la constante `MODULES` (ya no se usa).
- Eliminar el import de `Link` de `@tanstack/react-router` si deja de usarse.

## Resultado

El dashboard de la obra muestra solamente: header, tarjetas de Cliente/Contrato/Fechas, Equipo asignado y métricas placeholder. La navegación a los módulos se hace exclusivamente desde el bottom bar (móvil) o la barra lateral (desktop).
