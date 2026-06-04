
## Objetivo

Al importar el Excel de insumos, si el archivo trae unidades o categorías que aún no existen en sus catálogos, mostrar un paso previo donde el usuario los revise, complete y confirme su creación — en vez de marcarlos como error (unidades) o crearlos en silencio (categorías).

## Flujo nuevo

1. Subida del Excel (igual que hoy).
2. Validación cliente: nombre vacío, unidad vacía, categoría vacía, duplicados en archivo. (Ya NO se marca como error que la unidad o categoría no exista.)
3. Si hay errores "duros" → paso `errors` (igual que hoy).
4. **Nuevo paso `faltantes`** — solo se muestra si hay unidades o categorías nuevas:
   - Sección "Unidades nuevas": tabla con `código` (read-only, del Excel) + input `nombre descriptivo` (requerido, ej. KG → "Kilogramo").
   - Sección "Categorías nuevas": tabla con `nombre` (read-only) + input `prefijo` (3 letras/números, pre-llenado con `derivarPrefijo(nombre)`, editable).
   - Botones: "Cancelar" / "Continuar".
5. Paso `preview` (igual que hoy) — además muestra un resumen "Se crearán N unidades y M categorías nuevas".
6. Al confirmar, una sola llamada al servidor crea unidades, categorías e insumos en orden.

## Cambios técnicos

### `src/lib/api/insumos.functions.ts`
- `importarInsumos`: extender el input con `unidadesNuevas: [{ codigo, nombre }]` y `categoriasNuevas: [{ nombre, prefijo? }]`. En el handler:
  - Validar director.
  - Verificar que las unidades faltantes coincidan con `unidadesNuevas` (si falta alguna → error claro).
  - Insertar unidades nuevas en `insumo_unidades` (ignorar conflictos por `codigo`).
  - Insertar categorías nuevas (validar/derivar prefijo único) y mezclar al `catMap`.
  - Resto del flujo igual.
- Nueva server fn ligera `crearUnidadesBulk` no es necesaria — todo va dentro de `importarInsumos`.

### `src/components/insumos/ImportarInsumosDialog.tsx`
- Cargar también categorías existentes vía `listCategorias` para detectar faltantes en cliente.
- Quitar la regla "unidad inválida = error"; en su lugar, recolectar unidades y categorías no encontradas.
- Añadir estado `faltantes: { unidades: {codigo, nombre}[], categorias: {nombre, prefijo}[] }` y paso `"faltantes"`.
- Render del paso con dos tablas editables + validación (nombre/prefijo no vacíos, prefijo regex `^[A-Z0-9]{3}$`).
- En `preview` mostrar badge resumen de elementos nuevos a crear.
- Al confirmar, pasar `unidadesNuevas` y `categoriasNuevas` al server fn.
- Invalidar también `["insumo-unidades"]`.

## Fuera de alcance
- No se cambia la plantilla del Excel.
- No se modifica el catálogo de unidades/categorías por separado.
- La importación sigue siendo solo para Directores.
