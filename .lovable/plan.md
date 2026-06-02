## Plan: Insumos disponibles para renta

### 1. Categorías
Ya implementado. Confirmado por el usuario — sin cambios.

### 2. Flag `disponible_renta` en insumos

**Base de datos** (migración nueva):
- `ALTER TABLE insumos ADD COLUMN disponible_renta boolean NOT NULL DEFAULT false`
- Índice parcial: `CREATE INDEX idx_insumos_disponible_renta ON insumos(company_id) WHERE disponible_renta = true` para acelerar el selector en rentas.

**Backend** (`src/lib/api/insumos.functions.ts`):
- `listInsumos`: incluir `disponible_renta` en el select y aceptar filtro opcional `soloRenta?: boolean` (lo usará el módulo de rentas).
- `editarInsumo`: aceptar `disponible_renta` opcional (solo Director, ya está gateado).
- `solicitarInsumo`: NO acepta el flag (solo se marca al editar, según respuesta del usuario).

**UI catálogo** (`src/components/insumos/CatalogoInsumosModule.tsx`):
- `EditarInsumoDialog` (Director): agregar Checkbox "Disponible para rentas" con descripción corta ("Permite seleccionarlo al crear una solicitud de renta").
- En la tabla de insumos autorizados: badge pequeño "Renta" junto al nombre cuando `disponible_renta = true`.

### 3. Selector de insumo en Nueva Renta

**Backend** (`src/lib/api/rentas.functions.ts`):
- `crearSolicitudRenta`: agregar parámetro `insumo_id: string` (requerido), validar que el insumo pertenezca a la company y tenga `disponible_renta = true` y `estatus = autorizado`.
- Persistir `insumo_id` en `obra_rentas`.

**BD** (misma migración):
- `ALTER TABLE obra_rentas ADD COLUMN insumo_id uuid REFERENCES insumos(id)` (nullable para no romper filas existentes; nuevas solicitudes lo exigen a nivel de aplicación).

**UI** (`src/components/rentas/NuevaRentaDialog.tsx`):
- Reemplazar el campo libre "Equipo" por un Select/Combobox que liste insumos con `disponible_renta = true` de la company (orden alfabético, muestra `código — nombre (unidad)`).
- Mensaje vacío: "No hay insumos marcados como disponibles para renta. Pídele al Director que active el flag en el catálogo."
- El nombre/descripción del insumo seleccionado se usa como `equipo` para mantener compatibilidad con el detalle.
- Mantener: cantidad, periodicidad, fecha estimada, días aviso, descripción adicional.

**Vista de detalle** (`RentaDetalleSheet.tsx`): mostrar el insumo vinculado (código + nombre) cuando exista.

### Alcance
- Solo Director marca/desmarca el flag.
- Selector en rentas es obligatorio del catálogo (sin texto libre).
- Rentas existentes siguen funcionando con `insumo_id = NULL`.
- No se toca cotización, autorización ni cierre de rentas.
