# Módulo Catálogo de Insumos

Crear el módulo completo en `/app/obras/:obraId/catalogos` y `/app/admin/catalogos` (mismo componente reutilizado), reemplazando los placeholders actuales.

## 1. Base de datos (migración Supabase)

Una sola migración con:

**Enum**
- `insumo_unidad`: KG, M2, M3, ML, PZA, LT, TON
- `insumo_estatus`: autorizado, pendiente

**Tablas (todas con RLS scoping por `company_id` vía `current_company_id()` + `is_director_of()` para mutaciones sensibles)**

- `insumo_categorias` — id, company_id, nombre, created_at
  - SELECT: misma company
  - ALL: solo director de la company
- `insumos` — id, company_id, categoria_id (FK → insumo_categorias), nombre, unidad, estatus (default 'pendiente'), solicitado_por (uuid), autorizado_por (uuid null), autorizado_at (timestamptz null), created_at
  - SELECT: misma company
  - INSERT: usuarios de la company (solicitar)
  - UPDATE/DELETE: director (autorizar/rechazar)
- `insumos_historial_precios` — id, insumo_id (FK), precio_unitario numeric, proveedor text, fecha date, obra_id uuid, cantidad numeric, created_at
  - SELECT: misma company (vía join a insumos)
  - INSERT: futura integración órdenes de compra (por ahora director)

Cada `CREATE TABLE` con sus `GRANT` (authenticated + service_role), `ENABLE RLS`, y políticas.

## 2. Server functions (`src/lib/api/insumos.functions.ts`)

Todas con `requireSupabaseAuth`:

- `listInsumos({ estatus?, categoriaId?, unidad?, search? })` — lista insumos de la company del usuario, con join a `insumo_categorias` y subselect del último precio + proveedor desde `insumos_historial_precios` ordenado por fecha DESC.
- `listCategorias()` — categorías de la company.
- `getMetricasInsumos()` — totales: insumos, categorías, con historial, pendientes.
- `solicitarInsumo({ nombre, unidad, categoriaId })` — inserta con estatus 'pendiente', `solicitado_por = userId`.
- `autorizarInsumo({ id })` — solo director: estatus='autorizado', autorizado_por=userId, autorizado_at=now().
- `rechazarInsumo({ id })` — solo director: delete del insumo pendiente.
- `crearCategoria({ nombre })` / `editarCategoria({ id, nombre })` / `eliminarCategoria({ id })` — solo director; eliminar valida que no haya insumos con esa categoría.

Verificación de director: leer `user_roles` por `userId + company_id` y comprobar role='director' (la RLS también lo respalda).

## 3. UI

### Componente único `CatalogoInsumosModule`
Ubicación: `src/components/insumos/CatalogoInsumosModule.tsx`. Aceptado por ambas rutas (admin y obra).

**Rutas a actualizar**
- `src/routes/_authenticated/app.obras.$obraId.$.tsx`: si `slug === "catalogos"`, render `<CatalogoInsumosModule />` en lugar de placeholder.
- `src/routes/_authenticated/app.admin.$.tsx`: idem para `catalogos`.

**Layout (desktop-first, paleta primary #0f1e3d ya como token o se agrega a `styles.css`)**

```
Header: título "Catálogo de Insumos" + botones [Categorías] (director) [Solicitar insumo]
Banner alerta: visible si hay pendientes y user es director
Grid 4 cards métricas: Total insumos / Categorías / Con historial / Pendientes
Toolbar: input búsqueda, Select categoría, Select unidad
Tabs: [Autorizados (n)] [Pendientes (n) — solo director]
  Tab Autorizados: Table cols Nombre | Unidad | Categoría (badge color) | Último precio | Proveedor | Acciones (📈 historial, ✏️ editar)
  Tab Pendientes: Table cols Nombre | Unidad | Categoría | Solicitado por | Fecha | Acciones (Autorizar / Rechazar)
```

**Dialogs**
- `SolicitarInsumoDialog`: form con nombre (Input), unidad (Select), categoría (Select dinámico). Submit → `solicitarInsumo` + invalidate queries + toast.
- `CategoriasDialog` (director): lista categorías con inline edit/delete, input + botón agregar nueva.
- `HistorialPreciosDialog`: tabla con fecha, precio, proveedor, cantidad, obra del insumo seleccionado (read-only por ahora).
- `EditarInsumoDialog`: editar nombre, unidad, categoría.

**Color de badge por categoría**: hash del id de categoría → uno de ~6 tonos del design system (no colores ad-hoc, usar tokens).

**TanStack Query**: queryKeys `["insumos", filtros]`, `["insumo-categorias"]`, `["insumos-metricas"]`, `["insumo-historial", id]`. Invalidation tras cada mutación.

## 4. Notas técnicas

- Detección de director: `useAuthStore` → `isDirector(roles)`. Las queries de pendientes y los botones solo se montan si director.
- Validación con Zod en `inputValidator` de cada server fn.
- No se modifica `client.ts`, `types.ts` ni `config.toml`.
- Se requiere también añadir token CSS `--primary` actualizado solo si la paleta actual difiere — primero reviso `styles.css` y si ya es navy oscuro se reutiliza; si no, se ajusta solamente la variable primary del tema actual.

## 5. Orden de ejecución
1. Migración Supabase (espera aprobación).
2. Crear `insumos.functions.ts`.
3. Crear componente y subcomponentes/dialogs.
4. Actualizar las dos rutas splat para enrutar a `CatalogoInsumosModule`.
