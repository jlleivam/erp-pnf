## Dividir "Nombre completo" en 3 campos

### Base de datos (migración)

Agregar a `trabajadores`:
- `nombres text` (nombre(s) de pila)
- `apellido_paterno text`
- `apellido_materno text` (opcional)

Mantener `nombre_completo` como columna existente (fuente única para búsquedas, listados, notificaciones y snapshots de nómina). Se sigue escribiendo desde el backend, ahora compuesto como `trim("${nombres} ${apellido_paterno} ${apellido_materno}")`.

Backfill: para filas existentes, dejar los 3 campos nuevos en `null` y `nombre_completo` intacto (no se intenta parsear el string existente, evita errores).

### Backend (`src/lib/api/trabajadores.functions.ts`)

- Ampliar el Zod schema con `nombres` (requerido, min 1), `apellido_paterno` (requerido, min 1) y `apellido_materno` (opcional, nullable).
- Quitar `nombre_completo` del input; el handler lo compone: `[nombres, apellido_paterno, apellido_materno].filter(Boolean).join(" ").trim()`.
- Persistir los 3 campos nuevos + el compuesto en `insert` y `update`.
- `SELECT_LIST` y el select de detalle incluyen los 3 nuevos.

### Formulario (`TrabajadorFormDialog.tsx`)

Reemplazar el input único por una fila grid de 3 columnas dentro de "Datos personales":
- **Nombre(s)** * (obligatorio siempre)
- **Apellido paterno** * (obligatorio siempre)
- **Apellido materno** (opcional)

Validación: `nombres` y `apellido_paterno` requeridos en creación (ambos modos, coincide con el requisito previo de "nombre requerido"); en edición sin cambios se envían los valores actuales. Se elimina `nombre_completo` del estado del formulario.

`TrabajadorFormInitial` reemplaza `nombre_completo` por los 3 campos nuevos. `TrabajadorDetalle` y `CatalogoTrabajadoresModule` siguen leyendo `nombre_completo` (compuesto), sin cambios visibles.

### Fuera de alcance

- No se toca nómina, notificaciones, ni otros módulos: siguen consumiendo `nombre_completo`.
- No se hace parsing retroactivo de nombres ya capturados.