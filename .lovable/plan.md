## Problema

En el sheet de **Cotización** (`CotizacionSheet.tsx`) el encabezado muestra:
- `Solicitante: —`
- `Creada: —`
- `Enviada: —`
- Columna `Nota` de cada insumo con `—`

La causa es que `getCotizacionRequisicion` en `src/lib/api/cotizaciones.functions.ts` (línea 63-66) no está trayendo esos campos de la requisición. El `select` actual solo pide `id, folio, obra_id, company_id, estatus, notas, items(...)` sin `nota` en items, sin `created_at`, `enviada_at`, ni el solicitante (`creado_por` + join a `profiles`).

## Cambios

**`src/lib/api/cotizaciones.functions.ts`** — en `getCotizacionRequisicion`:

1. Ampliar el `select` de la requisición a:
   ```
   id, folio, obra_id, company_id, estatus, notas,
   created_at, enviada_at, creado_por,
   solicitante:profiles!requisiciones_creado_por_fkey(id, nombre_completo),
   items:requisicion_insumos(id, cantidad, fecha_requerida, nota, insumo:insumos(id, nombre, unidad))
   ```
   Si la FK a `profiles` no resuelve por nombre, hacer una consulta separada a `profiles` con `creado_por` y adjuntar el nombre al objeto `requisicion` antes de retornar.

2. Normalizar el campo `solicitante` en el retorno como string (nombre completo) para que `req.solicitante` funcione tal cual lo consume el componente.

**Sin cambios en el UI** — `CotizacionSheet.tsx` ya lee `req.solicitante`, `req.created_at`, `req.enviada_at` y `item.nota`.

## Verificación

Abrir la cotización de REQ-2026-001 y confirmar que el encabezado muestra solicitante/fechas y que la columna Nota refleja los textos capturados en la requisición.
