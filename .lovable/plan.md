
# Estimaciones semanales (producción)

## Concepto

Cada **semana fija Lun–Dom**, el **residente** captura por concepto la **cantidad ejecutada en esa semana** contra el **presupuesto vigente** (base + OC-P autorizadas). El sistema calcula importe, acumulado histórico, % avance y producción global. Se guarda como **borrador** editable cualquier día; al **cerrar la semana** queda inmutable y disponible para comparativos contra gastos (módulo futuro).

## Reglas clave

- **Semana**: Lun 00:00 → Dom 23:59 (ISO). Una sola estimación por obra+semana.
- **Captura**: cantidad **de la semana** (no acumulada). El sistema calcula:
  - `acumulado = Σ cantidades de semanas cerradas anteriores + cantidad semana actual`
  - `importe_semana = cantidad × PU_vigente`
  - `% avance concepto = acumulado / cantidad_vigente`
- **Bloqueo de sobre-ejecución**: si `acumulado > cantidad_vigente` el sistema **impide guardar**, con mensaje claro indicando cuánto sobra y sugiriendo levantar una OC-P primero.
- **Solo conceptos hoja** del vigente son capturables (los grupos suman automáticamente).
- **Estatus**: `borrador` (editable por residente) → `cerrada` (inmutable).
- **Quién**: el **residente miembro del obra_team** captura y cierra. Director puede ver/auditar. Una vez cerrada, ni el residente la modifica (solo el Director podría reabrir vía función especial — fuera de alcance ahora).
- **PU congelado al cierre**: al cerrar la semana, se persiste el snapshot del PU vigente usado para el cálculo, de modo que OCs futuras no alteren el histórico.

## Estructura de datos

### Tabla `obra_estimaciones`
- `id`, `obra_id`, `company_id`
- `numero` (autoincremental por obra)
- `semana_inicio` (date, lunes), `semana_fin` (date, domingo)
- `estatus`: enum `borrador | cerrada`
- `monto_total` (suma de renglones, recalculado en cada guardado)
- `creado_por`, `cerrada_por`, `cerrada_at`, `created_at`, `updated_at`
- Único: `(obra_id, semana_inicio)`

### Tabla `obra_estimacion_renglones`
- `id`, `estimacion_id`
- `renglon_clave` (WBS, ej `1.1.2`), `concepto`, `unidad`
- `cantidad_vigente`, `pu_vigente` (snapshot al momento del cierre / referencia para cálculo)
- `cantidad_ejecutada` (esta semana)
- `importe_ejecutado` (cantidad × pu, calculado)
- Único: `(estimacion_id, renglon_clave)`

Solo se guardan renglones con cantidad > 0 para mantener la tabla ligera.

### RLS
- SELECT: miembros de la company.
- INSERT/UPDATE/DELETE en borrador: Director o miembro de `obra_team`.
- UPDATE de `estatus=cerrada`: bloqueado vía policy (no se permite editar renglones de estimación cerrada).

## Server functions (`src/lib/api/estimaciones.functions.ts`)

- `listEstimaciones({ obraId })` — lista semanas con monto, estatus y % acumulado.
- `getOrCreateBorrador({ obraId, semanaInicio })` — devuelve borrador existente o crea uno nuevo para esa semana; incluye **árbol del vigente** con cantidades ya capturadas y acumulado de semanas cerradas previas.
- `guardarRenglonesEstimacion({ estimacionId, renglones })` — valida bloqueo de sobre-ejecución contra `acumulado_previo + cantidad_nueva ≤ cantidad_vigente`, recalcula importes y monto_total. Devuelve `{ errores[], monto_total }`.
- `cerrarEstimacion({ estimacionId })` — valida que esté en borrador, congela snapshot de PU vigente, cambia estatus a `cerrada`.
- `getEstimacion({ id })` — detalle para vista de solo lectura.

Lógica auxiliar en `src/lib/estimacion-utils.ts`:
- `calcularSemana(date) → { inicio, fin }` (lunes/domingo ISO).
- `getAcumuladoPrevio(obraId, semanaInicio, supabase)` → mapa `clave → cantidad acumulada` de semanas cerradas anteriores.

## UI

### Pestaña nueva "Estimaciones" en el módulo de obra
- Lista de semanas (Lun–Dom, monto, % acumulado de obra, estatus) + botón **"Nueva estimación"** que abre la semana actual (o la última no cerrada).

### `CapturaEstimacionSheet`
- Encabezado: rango Lun–Dom, estatus (badge), monto semana, % avance global.
- **Selector de semana** (calendario que sugiere la actual; permite semanas pasadas sin estimación).
- **Árbol del vigente** (mismo layout que VerVigente) con columnas:
  - Concepto / Unidad / Cant. vigente / **Cant. acumulada previa** / **Cant. esta semana (editable)** / Importe semana / % acumulado
- Filas grupo: solo lectura, suman hijos.
- Filas hoja: input numérico para cantidad de la semana.
- **Validación inline**: si acumulado_previo + cantidad > cantidad_vigente, marca el input en rojo con tooltip "Excede vigente por X. Levante una OC-P".
- Botones: **Guardar borrador** (autosave cada N seg también), **Cerrar semana** (confirm dialog que recalcula y bloquea si hay errores).
- Filtro/búsqueda por clave o concepto y opción "solo con avance".

### `VerEstimacionSheet` (solo lectura para semanas cerradas)
- Mismo árbol con valores congelados, sin inputs.

## Detalles técnicos

- Reutilizar `reconstruirVigente()` para obtener el árbol vigente al abrir el sheet.
- El acumulado previo se calcula sumando renglones de `obra_estimaciones` con estatus `cerrada` y `semana_inicio < semana_actual` para esa obra.
- Snapshot al cierre: copiar `cantidad_vigente` y `pu_vigente` actuales en cada renglón antes de marcar `cerrada`, para evitar drift si después se autoriza una OC-P.
- Solo Director puede ver estimaciones de obras donde no es residente (vía RLS por company).

## Fuera de alcance (siguiente iteración)

- Importación desde Excel de estimaciones.
- Comparativo estimación vs gastos semanales.
- Reabrir estimaciones cerradas.
- Workflow de aprobación por Director.

¿Procedo con este diseño?
