
# Nómina semanal por obra

## Concepto

Cada semana **Lun–Dom**, el **residente** de cada obra:
1. **Asigna** la lista de trabajadores que estarán en la obra esa semana (plantilla semanal).
2. **Captura asistencia diaria** por trabajador: jornada completa (1.0), media (0.5) o falta (0), más horas extras opcionales.

El **administrativo** tiene un **panel global** que cruza todas las obras de la semana para:
- Ver días totales pagados por trabajador.
- Detectar duplicados (suma > 1.0 día) con alerta visual.
- Consolidar el monto a pagar por trabajador.

## Reglas clave

- **Semana**: Lun 00:00 → Dom 23:59 (igual que estimaciones).
- **Unidad de asistencia**: `1.0`, `0.5`, `0` (jornada / media / falta).
- **Multi-obra mismo día permitido**: un trabajador puede tener `0.5` en obra A y `0.5` en obra B el mismo día. Cada residente captura su parte sin ver la de otras obras.
- **Anti-duplicado (advertir, no bloquear)**: si la suma del día entre todas las obras > 1.0, se muestra alerta en el panel global del administrativo (badge rojo "duplicado") y en el detalle del trabajador, pero el guardado no se bloquea. El administrativo resuelve manualmente.
- **Horas extras**: por día y trabajador, campo `horas_extras` (número) con `multiplicador` configurable a nivel renglón (default x2). Importe extra = `horas × (sueldo_diario / 8) × multiplicador`.
- **Sueldo**: se toma de `trabajadores.sueldo_diario` al momento de **abrir la semana** (snapshot en el renglón) para evitar drift si se ajusta el sueldo después.
- **Plantilla semanal**: se asignan trabajadores a la obra para esa semana. Sólo trabajadores con `estatus_autorizacion = autorizado` y sin `fecha_baja` previa al lunes de la semana.
- **Estatus**: `borrador` (residente edita) → `cerrada` (residente cierra, inmutable). El administrativo puede ver borradores en su panel.
- **Quién**: Residente (miembro `obra_team`) o Director captura/cierra. Administrativo sólo consulta el panel global; no edita asistencia.

## Estructura de datos

### `obra_nominas` (header semanal por obra)
- `id`, `obra_id`, `company_id`
- `semana_inicio` (lunes), `semana_fin` (domingo)
- `estatus`: enum `borrador | cerrada`
- `monto_total` (recalculado en cada guardado)
- `creado_por`, `cerrada_por`, `cerrada_at`, `created_at`, `updated_at`
- Único: `(obra_id, semana_inicio)`

### `obra_nomina_renglones` (un trabajador en esa nómina semanal)
- `id`, `nomina_id`, `trabajador_id`
- `sueldo_diario_snapshot` (numeric, congelado al asignar)
- `multiplicador_extras` (numeric, default 2)
- `dias_trabajados` (numeric, suma calculada de los 7 días, ej. 5.5)
- `horas_extras_total` (numeric)
- `importe_jornadas`, `importe_extras`, `importe_total`
- Único: `(nomina_id, trabajador_id)`

### `obra_nomina_asistencias` (asistencia día a día)
- `id`, `renglon_id`, `fecha` (date)
- `jornada` (numeric: 0, 0.5, 1.0)
- `horas_extras` (numeric, default 0)
- Único: `(renglon_id, fecha)`

Sólo se persisten filas con `jornada > 0` o `horas_extras > 0` para mantener la tabla ligera.

### RLS
- SELECT: miembros de la company.
- INSERT/UPDATE/DELETE: Director, Administrativo o miembro `obra_team` (sólo en nóminas `borrador`).
- Renglones cerrados son inmutables (vía policy `estatus = borrador`).

## Server functions (`src/lib/api/nominas.functions.ts`)

- `listNominas({ obraId })` — lista semanas con monto/estatus.
- `getOrCreateNomina({ obraId, semanaInicio })` — devuelve borrador o crea uno; incluye plantilla actual y matriz de asistencia (7 días × N trabajadores).
- `asignarTrabajadores({ nominaId, trabajadorIds })` — agrega trabajadores (con snapshot de sueldo). Remueve sólo si no tienen asistencias capturadas.
- `guardarAsistencias({ nominaId, asistencias[] })` — upsert por `(renglon_id, fecha)`; recalcula totales del renglón y de la nómina.
- `cerrarNomina({ nominaId })` — valida, cambia estatus a `cerrada`.
- `getPanelGlobalAdmin({ companyId, semanaInicio })` — para administrativo: por trabajador suma jornadas/extras de todas las obras de la semana, marca `tiene_duplicado` cuando algún día acumula > 1.0, devuelve desglose por obra.

## UI

### Pestaña "Nómina" en módulo de obra (residente)
- Lista de semanas con monto y estatus + botón "Nueva semana".
- `CapturaNominaSheet`:
  - Encabezado: rango Lun–Dom, estatus, monto semana.
  - Botón **"Asignar trabajadores"** → diálogo multi-select de trabajadores autorizados.
  - **Tabla matriz**: filas = trabajadores; columnas = L M M J V S D + "Extras" + "Total".
  - Cada celda de día: control rápido (botones segmentados `0 · ½ · 1` o popover) + input opcional horas extras.
  - Footer: total días, total horas extras, importe total.
  - Botones: **Guardar borrador** y **Cerrar semana**.

### Nuevo módulo global "Nómina" para administrativo (`/app/admin/nomina`)
- Selector de semana (default actual).
- Tabla global: trabajador / sueldo diario / total días / extras / importe / obras donde trabajó (chips) / **badge duplicado** si algún día sumó > 1.0.
- Click en trabajador → desglose por día con qué obra(s) cubrió cada fracción.
- Filtros: con duplicados, por obra, por estatus de nómina (borrador/cerrada).

### Acceso por rol
- Residente: ve sólo "Nómina" dentro de la obra donde es miembro.
- Director: ve ambas vistas.
- Administrativo: ve el panel global; opcional ver detalle por obra en solo lectura.

## Detalles técnicos

- Reutilizar `calcularSemana()` de `estimacion-utils.ts` (lunes/domingo ISO).
- Snapshot de `sueldo_diario` al insertar renglón; si trabajador se reajusta después, no afecta nóminas previas.
- Cálculo de importe extra: `horas_extras × (sueldo_diario_snapshot / 8) × multiplicador_extras`.
- Detección de duplicados en panel global: agrupar `obra_nomina_asistencias` por `(trabajador_id, fecha)` cruzando todas las obras de la company en esa semana, sumar `jornada`, marcar cuando `> 1.0`.
- Performance: índices en `(trabajador_id, fecha)` para consulta cross-obras.

## Fuera de alcance (siguiente iteración)

- Cálculo de IMSS/ISR y retenciones.
- Recibos de nómina (PDF, sellado SAT).
- Destajos (tabla separada).
- Aprobación formal por administrativo / firma digital.
- Importación de asistencia desde checador.

¿Procedo con este diseño?
