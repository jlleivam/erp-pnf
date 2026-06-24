
# Módulo: Gastos de oficina

Una sola pantalla en `/app/admin/gastos-oficina` con tres pestañas:

1. **Personal de oficina** – nómina fija (reutiliza `trabajadores`).
2. **Solicitudes de gasto** – flujo solicitud → aprobación director → CxP.
3. **Histórico** – gastos pagados y cargo contable a "Gastos de administración".

---

## 1. Base de datos (migración)

### a) Marcar trabajadores de oficina
Agregar a `public.trabajadores`:
- `es_personal_oficina boolean NOT NULL DEFAULT false`
- `periodicidad_pago` enum `('semanal','quincenal','mensual')` (nullable; sólo aplica si es oficina)
- `sueldo_periodo numeric` (nullable; sueldo fijo por periodo, independiente de `sueldo_diario` que es para obra)

En el catálogo de Trabajadores se agrega un toggle "Personal de oficina"; cuando se prende, aparecen los campos de periodicidad y sueldo.

### b) Nueva tabla `public.gastos_oficina`
Columnas:
- `id`, `company_id`, `folio` (autogenerado tipo `GO-2026-0001` con función `siguiente_folio_gasto_oficina`)
- `tipo` enum `('nomina_oficina','servicio','papeleria','otro')`
- `concepto text NOT NULL` (ej. "CFE recibo abril", "Papelería Office Depot")
- `proveedor_id uuid NULL` → `terceros(id)` (opcional)
- `beneficiario_trabajador_id uuid NULL` → `trabajadores(id)` (sólo cuando `tipo='nomina_oficina'`)
- `periodo_inicio`, `periodo_fin` (sólo para nómina; sirven para evitar duplicados)
- `monto numeric NOT NULL`
- `fecha_gasto date NOT NULL`
- `fecha_requerida_pago date`
- `notas text`
- `evidencia_url text` (recibo/factura subido a bucket `terceros-docs` o nuevo `gastos-oficina`)
- `estatus` enum `('pendiente_aprobacion','aprobada','rechazada','pagada','cancelada')` default `pendiente_aprobacion`
- `cxp_id uuid NULL` → `cuentas_por_pagar(id)` (se llena al aprobar)
- `motivo_rechazo text`
- `solicitado_por uuid`, `aprobado_por uuid`, `aprobado_at timestamptz`
- `created_at`, `updated_at`

Grants estándar (`authenticated`, `service_role`), RLS por `company_id` con `current_company_id()`. Política de aprobación/rechazo restringida a `director` o `administrativo` vía `has_role`.

### c) CxP – sin cambios de esquema
Se reutiliza `cuentas_por_pagar` con:
- `obra_id = NULL` (gasto no asignable a obra)
- `origen_tipo = 'gasto_oficina'`, `origen_id = gastos_oficina.id`
- `beneficiario_tipo` = `tercero` (proveedor) o `trabajador` (nómina oficina)

Validar que `obra_id` permita NULL en `cuentas_por_pagar`; si no, ajustar en la misma migración.

### d) Cuenta contable
Cuando la CxP se paga (flujo existente de `pagos`), asegurar que el asiento contable use la cuenta `"Gastos de administración"` cuando `origen_tipo='gasto_oficina'`, en lugar de "Costo de obra". Lo implementaremos en el handler de pagos (o en el `cuenta_contable` que se escribe en `asientos_contables`).

---

## 2. Backend (server functions)

Archivo `src/lib/api/gastos-oficina.functions.ts` con `requireSupabaseAuth`:

- `listGastosOficina({ estatus? })` – tabla principal con filtros.
- `crearGastoOficina(input)` – cualquier usuario con rol admin/residente lo solicita; queda `pendiente_aprobacion`.
- `aprobarGastoOficina({ id })` – sólo director/administrativo. Crea la CxP automáticamente (folio CxP normal, beneficiario y concepto heredados) y enlaza `cxp_id`. Cambia estatus a `aprobada`.
- `rechazarGastoOficina({ id, motivo })`.
- `cancelarGastoOficina({ id })`.
- `generarNominaOficinaDelPeriodo({ periodicidad, periodo_inicio, periodo_fin })` – botón en pestaña de Personal: recorre `trabajadores` con `es_personal_oficina=true` y la periodicidad indicada, crea un gasto `tipo='nomina_oficina'` por cada uno (idempotente: unique parcial `(beneficiario_trabajador_id, periodo_inicio, periodo_fin)` cuando tipo='nomina_oficina'). Quedan `pendiente_aprobacion` para que el director confirme y pase a CxP.

---

## 3. Frontend

### Ruta
Reemplazar el placeholder de `gastos-oficina` en `src/routes/_authenticated/app.admin.$.tsx` con `<GastosOficinaModule />`.

### `src/components/gastos-oficina/GastosOficinaModule.tsx`
Header + `Tabs`:

**Tab 1 – Personal de oficina**
- Lista de trabajadores con `es_personal_oficina=true` (nombre, puesto, periodicidad, sueldo por periodo, próximo pago estimado).
- Botón **"Agregar personal de oficina"** → abre selector de trabajadores existentes para marcarlos (o link al catálogo para alta nueva).
- Botón **"Generar nómina del periodo"** → diálogo: elegir periodicidad y fechas; al confirmar llama `generarNominaOficinaDelPeriodo` y avisa cuántos se crearon.

**Tab 2 – Solicitudes**
- Tabla de gastos con estatus `pendiente_aprobacion` y `aprobada` (no pagada aún). Columnas: folio, fecha, tipo, concepto, beneficiario, monto, estatus, acciones.
- Botón **"Nuevo gasto"** → diálogo con: tipo (servicio/papelería/otro), concepto, proveedor (opcional, autocompletado de terceros), monto, fecha, fecha requerida de pago, evidencia (upload opcional), notas.
- Acciones por fila (sólo director/administrativo): **Aprobar** (genera CxP automáticamente), **Rechazar** (pide motivo). Solicitante puede **Cancelar** si sigue pendiente.

**Tab 3 – Histórico**
- Gastos `pagada`, `rechazada`, `cancelada` con filtros por rango de fecha y tipo.
- Click en fila pagada → muestra CxP y pago vinculado (link o sheet).

Toda tabla en **un solo renglón** con `TruncatedCell` (regla del proyecto).

### Permisos UI
- Director/Administrativo: ven todo, aprueban/rechazan, generan nómina del periodo.
- Otros roles administrativos: pueden capturar solicitudes; ven sólo las propias y las aprobadas/pagadas.
- Residente/supervisor: sin acceso al módulo (lo oculta `AppShell`/`modules.ts` si no es director/admin).

---

## 4. Detalles técnicos

- Folios: `GO-AAAA-####` vía nueva función `siguiente_folio_gasto_oficina`.
- Idempotencia nómina oficina: índice único parcial `WHERE tipo='nomina_oficina' AND beneficiario_trabajador_id IS NOT NULL`.
- Al aprobar, el handler crea la CxP en la misma transacción lógica (server function) y devuelve el `cxp_id`.
- El pago de la CxP usa el dialog existente `RegistrarPagoCxPDialog` sin cambios.
- En `asientos_contables`, cuando `origen_tipo='gasto_oficina'`, `cuenta_contable = 'Gastos de administración'` (cargo) y `'Bancos'`/`'Cuentas por pagar - Administrativos'` según paso.

---

## Fuera de alcance (para después)

- Catálogo de servicios recurrentes (CFE, Telmex, renta) con recordatorios; ahora cada recibo se captura suelto.
- Reportes/gráficas de gasto administrativo por mes.
- Presupuesto anual de oficina y comparativo vs ejercido.
- Integración con SAT/CFDI 4.0.
- Asignación parcial de gastos de oficina a obras (prorrateo).
