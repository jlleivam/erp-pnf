# Importación masiva de Insumos por Excel

## 1. Dependencia
- `bun add xlsx` (SheetJS) para parseo en cliente y para generar plantilla + archivo de errores.

## 2. Server function (`src/lib/api/insumos.functions.ts`)

Añadir `importarInsumos`:

- Input (Zod): `{ filas: [{ nombre: string (1-200), unidad: enum UNIDADES, categoria: string (1-100) }] }` con `min(1).max(500)` filas.
- Middleware `requireSupabaseAuth` + verificación de Director (usa `getUserCompanyAndDirector`); si no es director → throw.
- Validación servidor:
  1. Cargar todos los insumos existentes de la company → set de nombres normalizados (lower+trim) para detectar duplicados contra BD.
  2. Detectar duplicados internos del archivo (nombre repetido entre filas).
  3. Si hay errores → throw con detalle (`{ row, error }[]`) para que el cliente pueda mostrarlos.
- Si todo válido:
  1. Cargar categorías existentes de la company. Para cada categoría única del archivo que no exista → `insert` en `insumo_categorias` y agregar al mapa.
  2. Bulk insert en `insumos` con `estatus='autorizado'`, `autorizado_por=userId`, `autorizado_at=now()`, `solicitado_por=userId`, `categoria_id` resuelto del mapa.
  3. Devolver `{ insertadas: n, categoriasCreadas: m }`.

Nota: Supabase JS no expone transacciones explícitas, pero un solo `insert([...])` es atómico a nivel statement; suficiente para el alcance.

## 3. UI

### Botón en header del módulo
- En `CatalogoInsumosModule.tsx` agregar botón `Importar Excel` (icono `FileSpreadsheet`/`Upload`) junto a `Solicitar insumo`, solo si `director`.

### Nuevo componente `ImportarInsumosDialog.tsx`
Tres estados internos (`'upload' | 'errors' | 'preview'`):

**Estado upload:**
- Drop/upload zone (input file `.xlsx,.xls`).
- Botón "Descargar plantilla" → genera con SheetJS un xlsx con encabezados exactos `nombre, unidad, categoría` + 1 fila de ejemplo.
- Texto guía: "Encabezados requeridos: nombre, unidad, categoría. Unidades válidas: KG, M2, M3, ML, PZA, LT, TON".

**Parseo y validación cliente (al subir):**
- Leer con `XLSX.read` → `sheet_to_json({ header: 1, defval: "" })`.
- Localizar fila de encabezados (primera con `nombre/unidad/categoría` normalizados — quitar acentos, lower).
- Mapear filas siguientes a `{ row, nombre, unidad, categoria }` (row = índice real del Excel, 1-based incluyendo header para mensajes legibles).
- Validar cada fila:
  - nombre vacío → "Nombre vacío"
  - nombre duplicado dentro del archivo → "Duplicado en el archivo"
  - unidad: uppercase + trim → si no está en UNIDADES → "Unidad inválida"
  - categoría vacía → "Categoría vacía"
- Si hay errores → estado `errors`. Si no → enviar al server fn `importarInsumos`; si server devuelve errores de duplicados con BD → fusionar y mostrar en estado `errors`. Si OK → estado `preview` con resumen + tabla de filas (mostrar primeras 100, contador total).

**Estado errors:**
- Mensaje rojo: "X errores encontrados — corrige el archivo y vuelve a subirlo".
- Tabla: Fila | Nombre | Unidad | Categoría | Error.
- Botón "Descargar archivo con errores": genera xlsx con las mismas columnas + columna extra "Error" (filas con error resaltadas en rojo via cell style si es viable, si no solo columna).
- Botón "Subir otro archivo" → vuelve a `upload`.

**Estado preview:**
- Card resumen: "X insumos listos para importar", subtítulo si hay categorías nuevas a crear: "Y categorías nuevas se crearán".
- Tabla preview (max 100 visibles + "y N más…").
- Botones: Cancelar / "Confirmar importación".
- Al confirmar: ejecutar `importarInsumos` (si no se ejecutó ya en validación) — flujo recomendado: hacer dry-run de validación de duplicados localmente con los datos en memoria (no requiere segunda llamada). Implementación concreta: hacer la llamada real al server fn solo al confirmar; si server devuelve errores de duplicado contra BD → cambiar a estado `errors` con esos errores.
- Al éxito: toast, invalidar `["insumos"]`, `["insumo-categorias"]`, `["insumos-metricas"]`, cerrar dialog.

## 4. Detalles técnicos
- Cliente solo: `xlsx` se carga estáticamente (es ESM-friendly y safe para Worker porque el dialog solo se renderiza en cliente). Si causa problemas de SSR, usar `import("xlsx")` dinámico dentro del handler de archivo.
- Limitar tamaño de archivo en cliente (e.g. 2MB) antes de parsear.
- No tocar `client.ts`, `types.ts` ni `config.toml`.
- Reutilizar componentes shadcn ya existentes (Dialog, Table, Button, Alert/Card).

## 5. Orden de ejecución
1. `bun add xlsx`
2. Añadir `importarInsumos` a `insumos.functions.ts`
3. Crear `src/components/insumos/ImportarInsumosDialog.tsx`
4. Wire botón + estado en `CatalogoInsumosModule.tsx`
