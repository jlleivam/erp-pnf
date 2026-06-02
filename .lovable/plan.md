## Objetivo

Agregar un flag "Disponible para rentas" en cada proveedor/tercero. Solo los proveedores con el flag activo aparecerán en el selector del diálogo de solicitud de cotización de rentas.

## Cambios

### 1. Base de datos (migración)
- Agregar columna `disponible_renta boolean NOT NULL DEFAULT false` a `public.terceros`.
- Índice parcial `WHERE disponible_renta` para acelerar el filtro por empresa.
- Sin cambios de RLS: la edición ya está cubierta por las políticas existentes de `terceros` (mismas que permiten editar el resto de campos del proveedor).

### 2. Backend — `src/lib/api/terceros.functions.ts`
- Incluir `disponible_renta` en el schema Zod de `crearTercero` / `editarTercero` (opcional, default `false`).
- Persistir el campo en insert/update.
- Incluir `disponible_renta` en `SELECT_LIST` para que aparezca en `listTerceros`.

### 3. UI — Catálogo de Terceros
- `src/components/terceros/TerceroFormDialog.tsx`: agregar `Checkbox` "Disponible para rentas" con descripción ("Si se activa, este proveedor podrá seleccionarse al cotizar rentas"). Aplica a categorías `proveedor` y `ambos` (no a `contratista`).
- `src/components/terceros/CatalogoTerceroModule.tsx` / `TerceroDetalle.tsx`: mostrar un badge "Renta" cuando esté activo (opcional, igual que el patrón usado en insumos).

### 4. UI — Rentas
- `src/components/rentas/CotizarRentaDialog.tsx`: ajustar el filtro de proveedores para incluir solo los que tengan `disponible_renta = true`, además de los criterios actuales de categoría. Actualizar el mensaje "No hay proveedores…" para mencionar el flag de rentas.

### Fuera de alcance
- Insumos, almacén, cotizaciones de compras: sin cambios.
- Permisos RLS: sin cambios; cualquiera con permiso de editar terceros puede activar el flag.