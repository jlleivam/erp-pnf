## Objetivo

Construir el módulo **Destajos** por obra, replicando la mecánica de Presupuesto + Estimaciones, con flujo de autorización por **Supervisor** y asignación de **trabajadores** que se reflejan en Nómina como filas bloqueadas (informativas para el administrativo).

Cada obra puede tener N destajos, cada uno con su destajista (un trabajador del catálogo), su WBS contratado, sus órdenes de cambio y sus estimaciones semanales de avance.

---

## 1. Modelo de datos

Nuevas tablas en `public` (mismas convenciones de GRANTs + RLS que `obra_presupuestos`/`obra_estimaciones`).

### `obra_destajos`
Cabecera del destajo (un "contrato" con un destajista en una obra).
- `obra_id`, `company_id`
- `destajista_id` → `trabajadores.id` (a quién se le paga)
- `numero` (consecutivo por obra), `nombre`, `descripcion`
- `estatus`: enum `destajo_estatus` = `borrador | enviado | autorizado | rechazado`
- `monto_total` (numeric) — total contratado vigente (base ± OCs autorizadas)
- `creado_por` (residente), `enviado_at`, `autorizado_por` (supervisor), `autorizado_at`, `rechazado_por`, `rechazado_at`, `rechazo_motivo`

### `obra_destajo_presupuestos`
Versionado tipo presupuesto: base + adendas (órdenes de cambio).
- `destajo_id`
- `tipo`: enum `presupuesto_destajo_tipo` = `base | adenda`
- `numero` (0 para base, 1..n para adendas)
- `nombre`, `descripcion`
- `estatus`: `borrador | enviado | autorizado | rechazado`
- `monto_total` (base) / `monto_delta` (adenda)
- `creado_por`, `enviado_at`, `autorizado_por`, `autorizado_at`, `rechazado_por`, `rechazado_at`, `rechazo_motivo`

### `obra_destajo_renglones`
Reutiliza la misma forma que `obra_presupuesto_renglones` (WBS multinivel con grupos): `clave`, `parent_clave`, `nivel`, `es_grupo`, `concepto`, `unidad`, `cantidad`, `precio_unitario`, `importe`, `tipo_movimiento` (`renglon | modificacion | adicion | eliminacion`), `importe_delta`, `orden`.
- FK: `presupuesto_destajo_id`

### `obra_destajo_trabajadores`
Asignación de trabajadores al destajo (para IMSS y aviso a nómina).
- `destajo_id`, `trabajador_id`
- `asignado_at`, `desasignado_at` (nullable)
- UNIQUE parcial: un trabajador solo puede tener **una asignación activa** (`desasignado_at IS NULL`) entre todos los destajos de la company → bloquea reasignación mientras esté activo.

### `obra_destajo_estimaciones`
Igual que `obra_estimaciones` pero por destajo.
- `destajo_id`, `company_id`, `numero`, `semana_inicio`, `semana_fin`
- `estatus`: `borrador | cerrada` (cerrada = monto pagable confirmado por residente; no requiere autorización del supervisor para no trabar pagos semanales).
- `monto_total`, `creado_por`, `cerrada_at`, `cerrada_por`

### `obra_destajo_estimacion_renglones`
Mismas columnas que `obra_estimacion_renglones`: snapshot del vigente + `cantidad_ejecutada`, `importe_ejecutado` (acumulado a la fecha).

### RLS (resumen)
- `SELECT`: cualquier miembro de la company.
- `INSERT/UPDATE/DELETE destajos / presupuestos / renglones`:
  - Director siempre.
  - Residente miembro de la obra **solo** si el documento está en `borrador`.
  - Supervisor de la company: solo `UPDATE` para autorizar/rechazar (cambia `estatus`, `autorizado_*`, `rechazado_*`).
- `obra_destajo_estimaciones`: residente miembro de la obra mientras esté en `borrador`; Director siempre.
- `obra_destajo_trabajadores`: gestiona Director o residente miembro de la obra.

---

## 2. Server functions — `src/lib/api/destajos.functions.ts`

Helpers `getCompanyAndRoles(supabase, userId)` → `{ companyId, isDirector, isSupervisor, isMemberObra(obraId) }`.

CRUD del destajo:
- `listDestajos({ obraId })` → cards con destajista, monto vigente, estatus, % avance acumulado.
- `getDestajo({ id })` → cabecera + presupuestos + trabajadores asignados.
- `crearDestajo({ obraId, destajistaId, nombre, descripcion })` (residente o director): crea destajo + presupuesto `base` en borrador.
- `enviarDestajo({ presupuestoId })`: borrador → enviado (residente).
- `autorizarDestajo({ presupuestoId })`: enviado → autorizado (solo supervisor o director).
- `rechazarDestajo({ presupuestoId, motivo })`.
- `eliminarDestajo({ id })`: solo borrador.

Renglones (paralelo a presupuesto de obra; reusar utilidades de `presupuesto-utils.ts`):
- `guardarRenglonesDestajo({ presupuestoDestajoId, renglones })`.
- `guardarRenglonesOCDestajo({ presupuestoDestajoId, renglones })` (modificación/adición/eliminación contra el vigente del destajo).
- `getVigenteDestajo({ destajoId })` → reconstruye base + OCs autorizadas (misma `reconstruirVigente`).
- `parsearExcelDestajo` / `descargarPlantillaDestajo` (reusar lógica de presupuesto).

Órdenes de cambio:
- `crearOrdenCambioDestajo({ destajoId, nombre, descripcion })`: requiere base autorizado.
- Mismo ciclo enviar/autorizar/rechazar.

Trabajadores:
- `listTrabajadoresDestajo({ destajoId })`.
- `asignarTrabajadores({ destajoId, trabajadorIds })`: valida que no estén activos en otro destajo de la company; reactiva si ya existe fila con `desasignado_at`.
- `desasignarTrabajador({ destajoId, trabajadorId })`.

Estimaciones:
- `listEstimacionesDestajo({ destajoId })`.
- `crearOAbrirEstimacionDestajo({ destajoId, semanaInicio })`: solo si destajo base está autorizado.
- `getEstimacionDestajo({ id })` → vigente + acumulado de semanas previas + esta semana.
- `guardarEstimacionDestajo({ id, cantidades })`.
- `cerrarEstimacionDestajo({ id })`.
- `eliminarEstimacionDestajo({ id })`.

Integración con nómina:
- `getTrabajadoresBloqueadosPorDestajo({ obraId })` → consumido por `CapturaNominaSheet` para mostrar (y bloquear edición de jornada/extras de) trabajadores cuyo pago vendrá del destajo. Devuelve `{ trabajador_id, destajo_id, destajo_nombre, destajista_nombre }`.

---

## 3. UI — `src/components/destajos/`

### `DestajosModule.tsx` (obra)
- Header con totales (Σ contratado vigente, Σ pagado en estimaciones cerradas, # destajos activos).
- Tabla / cards de destajos con: destajista, monto vigente, estatus, % avance, acciones (Ver / Editar / Estimaciones / Asignar trabajadores).
- Botón **Nuevo destajo** (residente o director).

### `NuevoDestajoDialog.tsx`
Selector de destajista (combobox de trabajadores), nombre, descripción → crea y abre captura.

### `CapturaDestajoSheet.tsx`
Reusa estructura de `CapturaPresupuestoSheet`: tabla WBS editable + importación Excel. Botón **Enviar a autorización** cuando esté listo. En modo `enviado`, vista solo lectura con botones **Autorizar** / **Rechazar** visibles solo para supervisor/director.

### `CapturaOrdenCambioDestajoSheet.tsx`
Espejo de `CapturaOrdenCambioSheet` con mismo flujo enviar/autorizar.

### `VerDestajoSheet.tsx` / `VerVigenteDestajoSheet.tsx`
Vistas solo lectura.

### `AsignarTrabajadoresDialog.tsx`
Lista trabajadores de la company; checkbox por trabajador; marca en gris los que ya están activos en otro destajo (con tooltip "Asignado a destajo X"). Guarda diff de altas/bajas.

### `EstimacionesDestajoTab.tsx` + `CapturaEstimacionDestajoSheet.tsx`
Réplicas de los componentes de estimaciones de obra, scoped al destajo. Cada renglón muestra: contratado, ejecutado previo, esta semana (input %), saldo, importe.

### Integración en `CapturaNominaSheet.tsx`
- Al cargar la nómina, llamar `getTrabajadoresBloqueadosPorDestajo({ obraId })`.
- Para esos trabajadores, agregar la fila con badge "Destajo: {nombre}" y dejar inputs de jornada/horas extras en `readonly` (forzando 0). Tooltip al hover explica el motivo.
- No se calcula importe para ellos en esta nómina (su pago va vía estimación del destajo).

---

## 4. Routing y navegación

- `src/lib/modules.ts`: la entrada `destajos` ya existe; quitarle el `ready: false` cuando aplique.
- En `src/routes/_authenticated/app.obras.$obraId.$.tsx` ya enruta `slug === "destajos"` → `<DestajosModule obraId={...} />` (agregar el `if` faltante).
- Considerar también `app/admin/destajos` para panel global (fuera de este alcance — solo dejar `ModulePlaceholder`).

---

## 5. Detalles técnicos

- Reusar `presupuesto-utils.ts` (`procesarRenglones`, `procesarOrdenCambio`, `reconstruirVigente`) sin tocarlo: las estructuras de WBS son idénticas.
- Reusar `estimacion-utils.ts` para semanas Lun–Dom.
- Snapshots de "vigente" al abrir estimación: igual que `obra_estimaciones` (se almacena `cantidad_vigente`, `pu_vigente` por renglón al crear la estimación).
- Tipos generados de Supabase (`src/integrations/supabase/types.ts`) se regeneran automáticamente tras la migración.

## Fuera de alcance

- Panel administrativo global de destajos (cross-obra).
- Generación de PDF de contrato del destajista.
- Liga directa de estimación de destajo cerrada → cuentas por pagar (queda como follow-up).
- Historial/auditoría de cambios de autorización.
- Comisiones del destajista o retenciones IMSS automáticas (la asignación es informativa; los cálculos quedan para una siguiente iteración).