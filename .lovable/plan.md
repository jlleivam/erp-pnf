## Objetivo
Permitir al Director crear/editar/eliminar unidades de medida para insumos (igual que ya hace con categorías), en lugar del enum fijo actual (`KG, M2, M3, ML, PZA, LT, TON, BTO`).

## Enfoque
Reemplazar el enum `insumo_unidad` por una tabla catálogo `insumo_unidades` por compañía. Esto da flexibilidad total (agregar/editar/eliminar) y queda alineado con el patrón de `insumo_categorias`.

## Cambios

### 1. Base de datos (migración)
- Crear tabla `public.insumo_unidades`:
  - `id`, `company_id`, `codigo` (texto corto, ej. "PZA"), `nombre` (opcional, ej. "Pieza"), `created_at`.
  - Único `(company_id, upper(codigo))`.
  - GRANTs para `authenticated` y `service_role`.
  - RLS:
    - SELECT: miembros de la compañía.
    - ALL: solo Director (`is_director_of(company_id)`).
- Migrar columna `insumos.unidad`:
  - Convertir de enum `insumo_unidad` a `text`.
  - Sembrar las 8 unidades actuales en `insumo_unidades` por cada compañía existente.
  - Eliminar el tipo enum `insumo_unidad` al final.
- Sin foreign key estricta (se valida en el server function) para mantener flexibilidad ante importaciones.

### 2. Backend (`src/lib/api/insumos.functions.ts`)
- Quitar `z.enum(UNIDADES)`; validar `unidad` como string (1–10 chars, mayúsculas) y verificar que exista en `insumo_unidades` de la compañía al crear/editar/importar.
- Nuevas server functions:
  - `listUnidades()` — lista las unidades de la compañía.
  - `crearUnidad({ codigo, nombre? })` — solo Director.
  - `editarUnidad({ id, codigo, nombre? })` — solo Director.
  - `eliminarUnidad({ id })` — solo Director; bloquear si está en uso por algún insumo.

### 3. UI (`src/components/insumos/CatalogoInsumosModule.tsx`)
- Reemplazar el array constante `UNIDADES` por carga dinámica vía `listUnidades`.
- Agregar botón "Unidades" junto al de "Categorías" (solo visible para Director) que abre un nuevo `UnidadesDialog` con tabla CRUD (mismo patrón que `CategoriasDialog`).
- Selects de unidad en filtros, `NuevoInsumoDialog` y `EditarInsumoDialog` se alimentan de la lista dinámica.

### 4. Importación (`ImportarInsumosDialog.tsx`)
- Validar `unidad` contra la lista dinámica de `insumo_unidades` (no contra el enum).
- Mensaje de error sugiere agregar la unidad desde el diálogo de Unidades.

## Fuera de alcance
- No se tocan otros módulos que solo leen `unidad` como texto (rentas, almacén). Al ser `text` siguen funcionando igual.
- Categorías y flag `disponible_renta` quedan intactos.
