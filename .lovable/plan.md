## Objetivo
Permitir guardar una requisición como **borrador** antes de enviarla, para retomarla después y enviarla cuando esté lista.

## Comportamiento

- En la hoja **"Nueva requisición"** se agrega un segundo botón: **"Guardar borrador"** junto a **"Enviar requisición"**.
- Un borrador:
  - No notifica al administrativo/director.
  - No requiere validaciones estrictas (se puede guardar con campos vacíos: cantidad 0, sin fecha, sin insumo). Solo se exige que al menos un renglón exista.
  - Es visible únicamente para quien lo creó (el residente/solicitante).
  - Aparece en la pestaña activa de requisiciones con badge **"Borrador"** distinto (gris) y sin folio consumido — el folio se asigna hasta enviarlo.
- Al abrir un borrador existente se reutiliza la misma hoja (`NuevaRequisicionSheet`) en modo edición: se puede seguir editando, **Guardar borrador** (actualiza) o **Enviar requisición** (aplica validaciones completas, asigna folio, cambia estatus a `enviada`, dispara notificaciones).
- Los borradores se pueden **eliminar** desde el listado (icono papelera, solo visible en borradores).

## Cambios técnicos

### Backend (`src/lib/api/requisiciones.functions.ts`)

- **`crearRequisicion`** — aceptar nuevo parámetro `comoBorrador: boolean` (default `false`).
  - Si `comoBorrador`: no llamar `siguiente_folio_requisicion`, insertar con `folio: null` (verificar si la columna lo permite; si no, generar folio temporal `BORRADOR-<shortid>` o hacer la columna nullable vía migración), `estatus: "borrador"`, sin `enviada_at`, sin notificaciones.
  - Relajar validación de items cuando es borrador (permitir `cantidad = 0`, `fecha_requerida` opcional, `insumo_id` opcional).
- Nueva función **`actualizarBorradorRequisicion`** — reemplaza items y notas de un borrador propio. Verifica `estatus === "borrador"` y `creado_por === userId`.
- Nueva función **`enviarBorradorRequisicion`** — valida items completos, asigna folio real, cambia estatus a `enviada`, setea `enviada_at`, dispara la misma lógica de notificaciones que `crearRequisicion`.
- Nueva función **`eliminarBorrador`** — solo si es borrador propio.
- **`listRequisiciones`** — filtrar borradores: mostrar solo los del usuario actual (los borradores ajenos no aparecen). No se cuentan como "activas" para admin/director.

### Migración

- Hacer `requisiciones.folio` nullable (o mantener y usar placeholder) — confirmar leyendo el schema; probable ajuste mínimo.
- Asegurar que el enum `estatus` incluya `"borrador"` (el filtro existente en línea 147 sugiere que ya existe; verificar en la migración).
- Política RLS: permitir a residentes ver/editar/borrar solo sus propios borradores.

### Frontend

- **`src/components/requisiciones/NuevaRequisicionSheet.tsx`**:
  - Aceptar prop opcional `borradorId?: string`. Cuando llega, cargar los datos existentes en el `useState` inicial.
  - Segundo botón "Guardar borrador" que llama `crearRequisicion` con `comoBorrador: true` o `actualizarBorradorRequisicion` según el modo.
  - "Enviar requisición" en modo borrador llama `enviarBorradorRequisicion`.
- **`src/components/requisiciones/RequisicionesModule.tsx`**:
  - Mostrar borradores con badge distinto y click abre la hoja con `borradorId`.
  - Botón eliminar (papelera) visible solo en filas con estatus `borrador`.

## Fuera de alcance
- Colaboración multi-usuario sobre un mismo borrador.
- Auto-guardado en cada tecla — el guardado es manual.
