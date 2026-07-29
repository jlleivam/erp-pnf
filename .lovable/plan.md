# Nueva pestaña "Recepciones" en la requisición + cierre correcto

## 1. Nueva pestaña "Recepciones" en `CotizacionSheet`

Después de la pestaña "OCs", agregar `Recepciones ({n})` que muestre, por cada OC de la requisición:

- Folio de OC + proveedor + estatus de OC (pendiente / recibida parcial / recibida) y estatus de pago (pendiente / parcial / pagada).
- Por insumo: cantidad pedida, cantidad recibida acumulada, pendiente por llegar (resaltado si > 0).
- Lista cronológica de recepciones (fecha, folio de remisión o "Sin remisión + motivo", quién recibió, link a evidencia).
- Resumen arriba: "Material recibido: X% · Pagado: Y%" y una línea final "Faltan N insumos por llegar y $M por pagar".

Solo lectura desde esta pestaña — el registro sigue haciéndose en el módulo de almacén de obra. Al pie, botón "Ir al almacén de obra" que abre el módulo correspondiente.

## 2. Nueva regla de cierre de requisición

Una requisición pasa a `completada` **solo cuando**:

- Todas sus OCs (no rechazadas) tienen `estatus = 'recibida'` **y** `estado_pago = 'pagada'`.

Hoy la promoción vive dentro de `registrarRecepcion` (`src/lib/api/almacen.functions.ts`) usando el cliente autenticado. Si el usuario que confirma no tiene permiso RLS sobre `requisiciones`, el UPDATE falla en silencio y la requisición queda desincronizada. Ya vimos ese caso en REQ-2026-001.

Solución: mover la lógica a un **trigger de base de datos** (`SECURITY DEFINER`) que se dispare tras cualquier cambio de estatus o de pago:

- Trigger `AFTER INSERT OR UPDATE OF estatus, estado_pago ON ordenes_compra` → recalcula el estatus de la requisición padre.
- Función `public.recompute_requisicion_estatus(_req_id uuid)`:
  - Si existen OCs no rechazadas AND todas están `recibida` AND todas están `pagada` → marcar requisición como `completada` (setear `completada_at = now()`, `completada_por = COALESCE(current_setting('request.jwt.claim.sub', true)::uuid, autorizacion_por, creado_por)`).
  - Nunca degradar otros estatus.
- Backfill: `UPDATE requisiciones` que ya cumplan la condición nueva.
- Quitar el bloque de auto-completado dentro de `registrarRecepcion` para que el trigger sea la única fuente de verdad.

## 3. Backend

Nuevo server fn `getRequisicionRecepciones({ requisicionId })` en `src/lib/api/requisiciones.functions.ts` que devuelva, por OC:

```
{ oc: { id, folio, proveedor, estatus, estado_pago, monto_pagado, total },
  insumos: [{ insumo_id, nombre, unidad, pedido, recibido, pendiente }],
  recepciones: [{ id, fecha, folio_remision, sin_remision, motivo_sin_remision, evidencia_url, recibido_por_nombre, partidas: [...] }] }
```

`evidencia_url` se genera con `createSignedUrl` sobre el bucket `almacen-remisiones` (60 min).

## 4. UI

- Nuevo componente `src/components/requisiciones/RecepcionesTab.tsx` (colapsables por OC, tablas compactas siguiendo el patrón existente con `TruncatedCell` + tooltips).
- Badges reutilizando `Badge` shadcn: verde "Completa", ámbar "Parcial", gris "Pendiente"; y para pago: verde "Pagada", ámbar "Parcial", gris "Pendiente".

## Archivos afectados

- Migración: función + trigger + backfill.
- `src/lib/api/almacen.functions.ts`: eliminar bloque de auto-completado en `registrarRecepcion`.
- `src/lib/api/requisiciones.functions.ts`: nuevo `getRequisicionRecepciones`.
- `src/components/requisiciones/CotizacionSheet.tsx`: agregar TabsTrigger + TabsContent "recepciones".
- `src/components/requisiciones/RecepcionesTab.tsx`: nuevo.
