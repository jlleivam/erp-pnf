## Diagnóstico

Verifiqué directamente la base de datos para REQ-2026-001 y confirmo:

- Existen **2 paquetes** (Construalcalde y Macrobodega) con sus líneas.
- Existen **2 órdenes de compra** en estatus `pendiente_autorizacion` (OC-2026-001 y OC-2026-002) ligadas a la requisición.

Sin embargo, al reabrir el sheet la UI muestra:

- **OCs (0)** en la pestaña.
- **0 de 5 insumos asignados** y "+ Proveedor" vacío en cada fila del comparativo.
- Las tarjetas "Pedido por proveedor" no aparecen.

Causa raíz: en `src/lib/api/cotizaciones.functions.ts` el loader `getCotizacionRequisicion` usa embeds tipo `proveedor:terceros(id, razon_social)` sobre `ordenes_compra` y `cotizacion_paquetes`. Revisé `pg_constraint` y **NO existen llaves foráneas** desde `ordenes_compra.proveedor_id → terceros.id` ni desde `cotizacion_paquetes.proveedor_id → terceros.id`. Cuando PostgREST no encuentra la relación, devuelve error; el código actual ignora el error (`const { data: ocs } = await ...` sin chequear `error`) y termina sirviendo arreglos vacíos. Al venir vacíos:

- La pestaña OCs cuenta 0.
- `paqueteByProveedor` queda vacío en `ComparativaTable`, por lo que la hidratación inicial no carga ninguna asignación y no se dibujan las tarjetas inferiores.
- `provBloqueado` no encuentra ninguna OC, así que nada queda candado.

Antes del cierre todo se veía bien (imagen 2) porque el estado local (`asignaciones` + `optimisticPendiente`) se mantenía en memoria desde la acción "Enviar a supervisor"; al desmontar el sheet ese estado se pierde y la rehidratación falla.

## Cambios

### 1. Migración SQL: agregar llaves foráneas faltantes

Agregar FKs para que los embeds de PostgREST funcionen y para integridad referencial. Ninguna borra datos.

```text
ordenes_compra:
  - requisicion_id  → requisiciones(id)        ON DELETE CASCADE
  - company_id      → companies(id)            ON DELETE CASCADE
  - obra_id         → obras(id)                ON DELETE RESTRICT
  - proveedor_id    → terceros(id)             ON DELETE RESTRICT
  - creado_por      → auth.users(id)           ON DELETE SET NULL
  - autorizada_por  → auth.users(id)           ON DELETE SET NULL
  - rechazada_por   → auth.users(id)           ON DELETE SET NULL

cotizacion_paquetes:
  - requisicion_id  → requisiciones(id)        ON DELETE CASCADE
  - company_id      → companies(id)            ON DELETE CASCADE
  - proveedor_id    → terceros(id)             ON DELETE RESTRICT
```

`paquete_id` en `ordenes_compra` ya tiene su FK; se respeta.

### 2. `src/lib/api/cotizaciones.functions.ts`

En `getCotizacionRequisicion`, agregar verificación de `error` para las dos consultas (`paquetes` y `ocs`) y lanzar `new Error(...)` si vienen con error. Así, si en el futuro un embed vuelve a romperse, el `errorComponent` lo muestra en vez de devolver datos en blanco silenciosamente.

## Resultado esperado

Al cerrar y reabrir el sheet sobre REQ-2026-001 (sin nuevas acciones):

- La pestaña muestra **OCs (2)**.
- En el comparativo, el renglón de Mortero aparece con la asignación a Construalcalde candada (icono de lock) y los renglones cubiertos por OCs de Macrobodega también candados.
- Las tarjetas "Pedido por proveedor" reaparecen con sus líneas y badge "Pendiente autorización".
- Solo quedan editables las filas de insumos que aún no se enviaron a autorización.

No se toca la lógica de UI ni los flujos de envío/autorización/rechazo/reapertura.
