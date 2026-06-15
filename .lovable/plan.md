## Modelo conceptual

- **Semana actual** = derivado, no es columna. Es la semana cuyo rango `[semana_inicio, semana_fin]` contiene hoy. Siempre existe una y solo una; si no hay registro, se crea al entrar al módulo.
- **Estado** (`almacen_semanas.estatus`):
  1. **`abierta`** — editable. Aplica a la semana actual.
  2. **`bloqueada`** — no editable. Aplica a la semana actual. Solo desbloqueable por solicitud aprobada.
  3. **`cerrada`** — terminal, definitiva. Aplica solo a semanas pasadas. Transición automática el lunes 00:00.

**Transiciones:**

```text
abierta  ──(residente/supervisor: Bloquear)──►  bloqueada
bloqueada ──(supervisor/director aprueba solicitud)──►  abierta
abierta   ──(cron lunes 00:00)──►  cerrada
bloqueada ──(cron lunes 00:00)──►  cerrada
cerrada   ──► (terminal, no se reabre)
```

## Base de datos

**Migración 1 — enum:**
- Agregar `'bloqueada'` al enum / check de `almacen_semanas.estatus`. (Hoy es texto con check `in ('abierta','cerrada')`; ampliar a `('abierta','bloqueada','cerrada')`.)
- Dato existente: la fila del 8–14 jun queda como `cerrada` (correcto, ya pasó). La del 15–21 jun actual queda `abierta`.

**Migración 2 — tabla de solicitudes de desbloqueo:**

```text
almacen_semana_desbloqueo_solicitudes
  id, company_id, obra_id, semana_id (FK almacen_semanas)
  solicitado_por (FK auth.users), motivo (text), solicitado_at
  estatus: 'pendiente' | 'aprobada' | 'rechazada'
  resuelto_por (FK auth.users, nullable), resuelto_at, respuesta (text, nullable)
  created_at, updated_at
```

RLS:
- Miembros de la obra pueden ver solicitudes de su obra.
- Residente y supervisor pueden insertar (`is_residente_de_obra` o `is_supervisor_de_obra`).
- Supervisor y director pueden actualizar (resolver).

**Migración 3 — cron auto-cierre lunes 00:00:**
- `pg_cron`: cada lunes a las 00:00 (zona del proyecto), `UPDATE almacen_semanas SET estatus='cerrada' WHERE estatus IN ('abierta','bloqueada') AND semana_fin < CURRENT_DATE`.
- Como red de seguridad, el server-fn `getSemanaActual` también ejecuta esta misma UPDATE al inicio (cubre el caso de que el cron falle o que nadie entre justo el lunes).

## Backend — `src/lib/api/almacen.functions.ts`

1. **Renombrar conceptualmente `getOrCreateSemanaAbierta` → `getSemanaActual`** (lógica nueva):
   - Auto-cerrar semanas vencidas (`semana_fin < hoy AND estatus != 'cerrada'`).
   - Buscar semana cuyo `[inicio, fin]` contenga hoy. Si no existe, crearla con `estatus='abierta'` y sembrar saldos iniciales desde la última semana cerrada anterior.
   - Devolver la fila tal cual (puede estar `abierta` o `bloqueada`).

2. **Eliminar `cerrarSemana`** (era cierre manual; ahora solo cron lo hace).

3. **Nuevo `bloquearSemana({ semanaId })`**:
   - Guard: caller es residente o supervisor de la obra; semana es la actual; estatus actual `abierta`.
   - `UPDATE estatus='bloqueada'`.

4. **Nuevo `solicitarDesbloqueoSemana({ semanaId, motivo })`**:
   - Guard: caller es residente o supervisor; semana estatus `bloqueada`; no hay solicitud `pendiente` previa.
   - Insertar solicitud + notificar a supervisor y director.

5. **Nuevo `listSolicitudesDesbloqueo({ obraId, estatus? })`** — para el panel.

6. **Nuevo `resolverSolicitudDesbloqueo({ solicitudId, accion: 'aprobar'|'rechazar', respuesta? })`**:
   - Guard: caller es supervisor de la obra o director de la company.
   - Si aprobar: `UPDATE solicitud SET estatus='aprobada'` + `UPDATE semana SET estatus='abierta'` + notificar al solicitante.
   - Si rechazar: `UPDATE solicitud SET estatus='rechazada'` + notificar.

7. **Guards de edición en `actualizarUtilizado` y `registrarRecepcion`:** rechazar con mensaje `"Semana bloqueada"` si `estatus != 'abierta'`.

## UI — `SemanaActualPanel.tsx`

- Quitar botón "Cerrar semana" y diálogo correspondiente.
- Badge de estatus:
  - `abierta` → verde "Abierta"
  - `bloqueada` → ámbar "Bloqueada" con icono candado
- Botón contextual derecho según estatus + rol:
  - `abierta` + (residente|supervisor) → **"Bloquear semana"** (confirmación: "Una vez bloqueada solo podrá reabrirse con aprobación del supervisor").
  - `bloqueada` + (residente|supervisor) sin solicitud pendiente → **"Solicitar desbloqueo"** (dialog con campo motivo).
  - `bloqueada` + solicitud pendiente → texto "Desbloqueo solicitado el …" (sin botón).
- Inputs de `utilizado` deshabilitados cuando `estatus='bloqueada'`.
- Subtítulo `(lun–dom)` permanece.

## UI — Panel de solicitudes (supervisor/director)

- Nueva sección en `AlmacenModule` visible solo a supervisor/director: pestaña "Solicitudes" o bloque en `SemanaActualPanel` listando solicitudes `pendiente` con botones **Aprobar** / **Rechazar** y campo de respuesta opcional.

## Archivos a tocar

- `supabase/migrations/...` (3 migraciones)
- `src/lib/api/almacen.functions.ts` — refactor de estado + nuevas server-fns
- `src/components/almacen/SemanaActualPanel.tsx` — badge, botones contextuales, inputs deshabilitados
- `src/components/almacen/AlmacenModule.tsx` — sección/pestaña de solicitudes para supervisor/director
- `src/routes/api/public/hooks/cerrar-semanas-vencidas.ts` — endpoint llamado por `pg_cron` (red de seguridad además del SQL puro)

## Notas

- Mantener `cerrada_at` / `cerrada_por` para auditoría; con cierre automático ambos quedan `now()` / `null`.
- El traslado de saldos finales a la nueva semana ya ocurre al crear la semana actual cuando no existe (lógica de seed actual), así que el cron solo cambia estatus; no necesita crear la siguiente semana — la próxima vez que alguien entre, `getSemanaActual` la crea.
