## Objetivo

En el bloque "Seguimiento" del detalle de la requisición, mostrar **quién** completó cada paso y **a qué hora** (fecha + hora), no solo la fecha.

## Estado actual

La UI ya soporta mostrar el responsable (`step.porField` → `cotizacion_responsable`, `autorizacion_responsable`, `oc_responsable`, `completada_responsable`) y la fecha (`step.atField`). El problema es doble:

1. **Faltan datos**: las transiciones de estatus solo escriben las columnas `*_at` (cotizacion_at, autorizacion_at, oc_at, completada_at), pero **nunca escriben las columnas `*_por`**, por lo que el responsable siempre llega `null` excepto en "Requisición enviada" (que sí guarda `creado_por`).
2. **Solo se muestra la fecha**: `formatDate` no incluye la hora.

## Cambios

### 1. Guardar el responsable en cada transición

En `src/lib/api/cotizaciones.functions.ts`:
- `recalcEstatusRequisicion(supabase, requisicionId)` → agregar parámetro `userId` y al construir el `patch`, incluir el `*_por` correspondiente:
  - `en_cotizacion` → `cotizacion_por = userId`
  - `pendiente_autorizacion` → `autorizacion_por = userId`
  - `oc_generada` → `oc_por = userId`
  - `completada` → `completada_por = userId`
- Actualizar las ~9 llamadas internas para pasar `userId` (ya disponible en cada `.handler` vía `context`).

En `src/lib/api/solicitudes-cotizacion.functions.ts`:
- Misma actualización: pasar `userId` a su `recalcEstatusRequisicion` y al `update` directo de la línea 34 (`cotizacion_at` + `cotizacion_por`).

En `src/lib/api/almacen.functions.ts` (línea 334):
- En el `update` que marca la requisición como completada, agregar `completada_por: userId`.

No se requieren cambios de esquema: las columnas `cotizacion_por`, `autorizacion_por`, `oc_por`, `completada_por` ya existen en `requisiciones` (de hecho `getRequisicion` ya las lee y resuelve a nombres).

### 2. Mostrar fecha + hora en el timeline

En `src/lib/format.ts`:
- Añadir helper `formatDateTime(d)` con formato `es-MX` que incluya día, mes corto, año, hora y minutos (ej. `8 jun 2026, 14:32`).

En `src/components/requisiciones/RequisicionDetalleSheet.tsx`:
- Reemplazar `formatDate(at)` por `formatDateTime(at)` solo dentro del bloque de Seguimiento (línea 133). El resto del archivo sigue usando `formatDate`.

## Alcance fuera del plan

- No se rellenan datos históricos: las requisiciones ya transicionadas antes de este cambio seguirán sin responsable en pasos intermedios (solo lo verán las nuevas a partir de este cambio).
- No se modifica la lógica de notificaciones ni el esquema de BD.
