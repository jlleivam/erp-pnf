
## Plan: Campo `código` en catálogo de insumos

### Formato
`[PREFIJO_CATEGORÍA]-[CONSECUTIVO 4 dígitos]` — ej. `CEM-0001`, `ACE-0023`, `GEN-0007` (sin categoría).

### Cambios en base de datos (migración)

1. **`insumo_categorias`**: agregar columna `prefijo TEXT NOT NULL` (3 letras mayúsculas, validado con CHECK `^[A-Z]{3}$`). Default = primeras 3 letras del nombre. Único por `company_id`.
2. **`insumos`**: agregar columna `codigo TEXT` (único por `company_id`, índice).
3. **Función `siguiente_codigo_insumo(_company_id uuid, _categoria_id uuid)`**:
   - Lee el prefijo de la categoría (o `'GEN'` si null).
   - Calcula `MAX(consecutivo) + 1` por prefijo dentro de la compañía.
   - Devuelve `'PREFIJO-0001'` con padding 4.
4. **Backfill**: asignar prefijo a categorías existentes (3 primeras letras en mayúsculas, desambiguar duplicados con sufijo) y generar `codigo` para insumos existentes ordenados por `created_at`.
5. **Trigger `BEFORE INSERT` en `insumos`**: si `codigo IS NULL`, autogenera con la función.

### Cambios en backend (`src/lib/api/insumos.functions.ts`)

- **`listInsumos`**: incluir `codigo` y `categoria.prefijo` en el select; ampliar `search` para buscar por código además del nombre.
- **`solicitarInsumo`**: sin cambios (trigger asigna código al autorizar — ver siguiente).
- **`autorizarInsumo`**: si el insumo no tiene código, generarlo en ese momento (para evitar quemar consecutivos en solicitudes rechazadas).
- **`editarInsumo`**: aceptar `codigo` opcional; validar formato `^[A-Z]{2,5}-\d{3,6}$` y unicidad por compañía. **No** regenerar automáticamente si cambia la categoría.
- **`crearCategoria`** y **`editarCategoria`**: aceptar `prefijo` (3 letras), validar único por compañía. Default auto desde nombre si viene vacío.
- **`importarInsumos`**: ignorar cualquier columna de código del Excel; autogenerar todos los códigos al insertar (las categorías nuevas creadas durante la importación usan prefijo derivado del nombre).

### Cambios en UI (`src/components/insumos/CatalogoInsumosModule.tsx`)

- **Tabla autorizados**: nueva primera columna `Código` (monospace, badge sutil).
- **Tabla pendientes**: mostrar `— (al autorizar)` en columna código.
- **`EditarInsumoDialog`**: input adicional `Código` (solo Director, editable, con validación de formato y mensaje de unicidad).
- **`CategoriasDialog`**: input adicional `Prefijo (3 letras)` al crear/editar categoría, con autocompletado desde el nombre.
- **Búsqueda**: placeholder pasa a "Nombre o código...".
- **`SolicitarDialog`** y **`ImportarInsumosDialog`**: nota informativa "El código se genera automáticamente al autorizar".

### Fuera de alcance
- Regeneración masiva de códigos al cambiar prefijo de categoría (queda como acción manual futura).
- Edición de código por Administrativo (se mantiene solo Director, como hoy).

### Archivos tocados
- `supabase/migrations/<nuevo>.sql` (schema + función + trigger + backfill)
- `src/lib/api/insumos.functions.ts`
- `src/components/insumos/CatalogoInsumosModule.tsx`
- `src/components/insumos/ImportarInsumosDialog.tsx` (solo nota informativa)
