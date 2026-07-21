## Objetivo
Agregar el campo opcional **Nombre comercial** a proveedores y contratistas.

## Cambios

1. **Base de datos** (migración)
   - `ALTER TABLE public.terceros ADD COLUMN nombre_comercial text;`

2. **Backend** (`src/lib/api/terceros.functions.ts`)
   - Agregar `nombre_comercial` al `fieldsSchema` (opcional, nullable, max 255).
   - Incluirlo en `buildPayload`.
   - Agregarlo al `SELECT_LIST` para mostrarse en la tabla del catálogo.

3. **Tipos** (`src/components/terceros/constants.ts`)
   - Añadir `nombre_comercial: string | null` a `Tercero` y a `TerceroListRow`.

4. **Formulario** (`src/components/terceros/TerceroFormDialog.tsx`)
   - Añadir input "Nombre comercial" en la sección de Identificación, justo debajo de Razón social.

5. **Detalle** (`src/components/terceros/TerceroDetalle.tsx`)
   - Mostrar el nombre comercial en la cabecera/datos fiscales cuando exista.

6. **Catálogo** (`src/components/terceros/CatalogoTerceroModule.tsx`)
   - En la columna "Nombre" mostrar razón social como principal y nombre comercial como subtítulo si existe (manteniendo el diseño de un solo renglón con tooltip).
   - Incluir nombre comercial en el filtro de búsqueda.
