## Objetivo

Que el click en "Requisiciones" del sidebar abra una **vista global** que muestre únicamente las requisiciones de las **obras asignadas al usuario** (vía `obra_team`), con acceso al detalle de cada una.

## Cambios

### 1. Server function `listRequisicionesAsignadas`

En `src/lib/api/requisiciones.functions.ts`, agregar:

```ts
listRequisicionesAsignadas({ soloActivas?: boolean })
```

- Usa `requireSupabaseAuth`.
- Si el usuario **es director**: trae todas las requisiciones de la company (acceso completo).
- Si no: filtra por `obra_id IN (SELECT obra_id FROM obra_team WHERE user_id = auth.uid())`.
- Devuelve: `id, folio, estatus, enviada_at, created_at, notas, obra: {id, nombre}, creador: {nombre_completo}, insumos_count`.
- Orden: `enviada_at DESC NULLS LAST, created_at DESC`.
- `soloActivas` excluye `completada` y `rechazada`.

### 2. Ruta nueva `/app/admin/requisiciones`

Crear `src/routes/_authenticated/app.admin.requisiciones.tsx`:

- Header: "Requisiciones" + subtítulo "De tus obras asignadas".
- Tabs **Activas / Historial** (igual semántica que módulo por-obra).
- Tabla mobile-first con columnas: **Folio · Obra · Solicitante · Insumos · Estatus · Fecha**.
- Click en fila → abre `RequisicionDetalleSheet` (ya existe y sólo necesita `requisicionId`).
- Filtro opcional por obra (`Select` con las obras del usuario, derivadas de los resultados).
- Empty state si el usuario no tiene obras asignadas o no hay requisiciones.

Sin migraciones. Sin botón "Nueva" (esa acción vive dentro de cada obra).

### 3. Splat admin sigue como está

`app.admin.$.tsx` permanece para los otros módulos placeholder. La ruta concreta `app.admin.requisiciones.tsx` tiene prioridad sobre el splat.

### 4. Sidebar — sin cambios necesarios

El link `/app/admin/requisiciones` ya existe en `ADMIN_MODULES`. Sólo se muestra a director/administrativo (que es exactamente quien necesita la vista global). El residente accede vía el módulo de obra.

## Archivos

- editar `src/lib/api/requisiciones.functions.ts` → añadir `listRequisicionesAsignadas`
- crear `src/routes/_authenticated/app.admin.requisiciones.tsx`

¿Procedo?