## Problema

Dos residentes cierran su nómina y el mismo trabajador queda con jornadas que suman más de 1.0 en un día. Hoy el panel global (`/app/admin/nomina`) sólo **detecta** el duplicado: lo marca en rojo y lo lista en el detalle, pero no permite corregirlo, porque una nómina `cerrada` bloquea la edición tanto en la API como en las reglas de acceso de la base de datos. La semana se puede pagar igual, arrastrando el error.

## Solución

El administrativo (y el director) podrán ajustar la asistencia directamente desde el panel global, aun con la nómina cerrada, dejando registro; y no se podrá enviar a pagos una semana con duplicados sin resolver.

### 1. Ajuste directo con bitácora

En el detalle del trabajador (el diálogo que ya existe al hacer click en su renglón), cada celda día × obra se vuelve editable para admin/director:

- Selector de jornada (0 / 0.5 / 1) y horas extras.
- Motivo del ajuste obligatorio (mínimo 5 caracteres) — se pide una vez por ajuste.
- La celda ajustada muestra un indicador y, al pasar el cursor, quién ajustó, cuándo, el valor anterior y el motivo.
- La fila "Suma diaria" se recalcula al momento: en rojo mientras pase de 1.0 jornada, en verde cuando queda cuadrado.

Cada ajuste recalcula el importe del renglón, el `monto_total` de la nómina de esa obra y, por lo tanto, el reparto del costo entre obras.

### 2. Bloqueo del pago

- El panel global muestra el conteo de "Con duplicados" y, si es mayor a cero, un aviso de que la semana no puede pagarse.
- En la pestaña de pagos (Cuentas por pagar → Nómina), la semana con duplicados aparece marcada y su botón de pago queda deshabilitado, con un enlace al panel global.
- El servidor también rechaza el pago si detecta duplicados en la semana, para que el bloqueo no dependa sólo de la interfaz.

### 3. Quién puede hacerlo

Sólo director y administrativo. El residente sigue sin poder tocar una nómina cerrada.

## Detalles técnicos

**Base de datos** (una migración sobre `obra_nomina_asistencias`):
- `jornada_original`, `horas_extras_original` (numeric, nullable) — snapshot del valor previo al primer ajuste.
- `ajustado_por` (uuid), `ajustado_at` (timestamptz), `ajuste_motivo` (text).

No se cambian las políticas de acceso: la edición sobre nóminas cerradas se hace desde el servidor con privilegios elevados, después de verificar rol y empresa.

**Server functions** en `src/lib/api/nominas.functions.ts`:
- `ajustarAsistenciaAdmin({ renglonId, fecha, jornada, horasExtras, motivo })`: valida rol director/administrativo y misma empresa, exige motivo, guarda snapshot original la primera vez, hace upsert/borrado de la asistencia, recalcula el renglón y el `monto_total` de la nómina. Rechaza nóminas ya `pagada`.
- `getPanelGlobalNomina`: devolver también, por asistencia, los campos de ajuste para pintar el indicador.
- Helper `semanaTieneDuplicados(companyId, semanaInicio)`; usarlo en `listSemanasNominaPorPagar` (para marcar la semana) y en `pagarNominaSemana` (para abortar con mensaje claro).

**UI**:
- `src/components/nomina/NominaAdminPanel.tsx`: celdas editables + diálogo de motivo en `DetalleTrabajadorDialog`, banner de bloqueo, invalidación de la query `nomina-panel` tras cada ajuste.
- `src/components/pagos/NominaPorPagarTab.tsx`: badge de conflicto y botón de pago deshabilitado con tooltip.

## Fuera de alcance

- No se reabre la nómina ni se devuelve al residente.
- No se agrega un estado de "duplicado justificado": toda suma mayor a 1.0 debe corregirse.
- No se tocan las capturas de nómina en obra ni la contabilidad del pago.
