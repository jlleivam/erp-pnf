## Objetivo

En la vista de detalle de requisición (la sheet que ve el residente al abrir una requisición desde la obra), agregar dos columnas adicionales por insumo:

- **Pedido**: cantidad efectivamente incluida en la(s) OC generada(s) a partir de esa requisición.
- **Recibido**: cantidad realmente recibida en almacén contra esas OC.

Así el residente puede comparar de un vistazo: solicitado vs pedido vs recibido.

## Origen de los datos

- `requisicion_insumos` → cantidad **solicitada** (ya se muestra).
- `cotizacion_paquetes` (filtrados por `requisicion_id`) + `cotizacion_paquete_insumos` → cantidad **pedida**, sumada por `insumo_id`. Solo se cuentan paquetes que efectivamente tienen una OC asociada en `ordenes_compra` con estatus distinto de `borrador` / `rechazada` (es decir, la OC fue al menos enviada al proveedor o autorizada).
- `almacen_recepciones` (vía `oc_id` ∈ OCs de esta requisición) + `almacen_recepcion_partidas` → cantidad **recibida**, sumada por `insumo_id`.

## Cambios

### 1. `src/lib/api/requisiciones.functions.ts` — `getRequisicion`

Después de obtener la requisición y sus items, hacer dos queries adicionales en el mismo handler:

1. OCs de la requisición:
   ```ts
   supabase.from("ordenes_compra")
     .select("id, estatus, paquete_id, paquete:cotizacion_paquetes(insumos:cotizacion_paquete_insumos(insumo_id, cantidad))")
     .eq("requisicion_id", data.id)
     .not("estatus", "in", "(borrador,rechazada)")
   ```
   Agregar a un mapa `pedidoPorInsumo: Record<insumo_id, number>` sumando `cantidad` de los `paquete.insumos`.

2. Recepciones de esas OCs:
   ```ts
   supabase.from("almacen_recepcion_partidas")
     .select("insumo_id, cantidad, recepcion:almacen_recepciones!inner(oc_id)")
     .in("recepcion.oc_id", ocIds)
   ```
   Agregar a `recibidoPorInsumo: Record<insumo_id, number>`.

3. Enriquecer cada `item` con `pedido` y `recibido` antes de devolver:
   ```ts
   items: req.items.map(it => ({
     ...it,
     pedido: pedidoPorInsumo[it.insumo.id] ?? 0,
     recibido: recibidoPorInsumo[it.insumo.id] ?? 0,
   }))
   ```

No tocar otras funciones, ni cálculos en otras vistas.

### 2. `src/components/requisiciones/RequisicionDetalleSheet.tsx`

En la tabla de "Insumos solicitados":

- Renombrar el header `Cantidad` → `Solicitado` (más claro al lado de Pedido/Recibido).
- Añadir dos `TableHead` (a la derecha, `text-right`): **Pedido** y **Recibido**.
- En cada `TableRow`, añadir dos celdas `text-right tabular-nums`:
  - `it.pedido` (mostrar `0` si no hay OC todavía).
  - `it.recibido` (mostrar `0` si no hay recepción).
- Cuando `recibido >= solicitado`, marcar la celda recibido con `text-emerald-600 font-medium`. Cuando `0 < recibido < solicitado`, `text-amber-600`. Cuando `pedido == 0`, mantener gris (`text-muted-foreground`) para que se vea que aún no se ha generado OC.

Orden final de columnas: Insumo · Solicitado · Pedido · Recibido · Unidad · Fecha req. · Nota.

Cantidad mostrada con `Number(x).toLocaleString("es-MX")` para consistencia.

## Sin cambios

- Backend/schema (no migraciones, no nuevas tablas).
- Permisos / RLS.
- Listado de requisiciones, timeline, módulo administrativo, cotizaciones, OC, almacén.
- Otras pantallas que consumen `getRequisicion` siguen funcionando porque solo se **añaden** dos campos opcionales a cada item.

## Archivos tocados

- `src/lib/api/requisiciones.functions.ts` (handler `getRequisicion`).
- `src/components/requisiciones/RequisicionDetalleSheet.tsx` (tabla de insumos).
