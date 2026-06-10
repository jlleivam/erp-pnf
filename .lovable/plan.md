## Objetivo

Insertar el paso de **autorización del supervisor** entre el cierre de la estimación y la generación contable. Al autorizar, se crea un **pasivo (CxP) hacia el contratista** y su **asiento contable**. El pago final ya no se genera al cerrar la semana — lo genera el administrativo desde Cuentas por Pagar, ligándolo al CxP.

---

## Flujo nuevo

```text
borrador  →  cerrada  →  autorizada  →  pagada
                ↑   ↘
                │    rechazada (regresa a borrador al editar)
                │
            (residente)   (supervisor / director)   (administrativo)
```

- **borrador**: residente captura cantidades.
- **cerrada**: residente termina la semana. Cantidades/precios congelados. **No** se genera nada contable todavía.
- **autorizada**: supervisor (o director) revisa y aprueba. Se crea CxP + asiento contable. No editable.
- **rechazada**: supervisor regresa la estimación con motivo. El residente puede volver a `borrador` al editar.
- **pagada**: administrativo registra el pago contra el CxP (puede ser parcial — saldo se mantiene hasta liquidar).

---

## Cambios en BD (migración única)

### 1. Enum `destajo_estimacion_estatus`
Agregar valores: `autorizada`, `rechazada`, `pagada`.

### 2. Columnas nuevas en `obra_destajo_estimaciones`
- `autorizada_at timestamptz`, `autorizada_por uuid` (FK auth.users)
- `rechazada_at timestamptz`, `rechazada_por uuid`, `rechazo_motivo text`
- `cxp_id uuid` (FK a cuentas_por_pagar, SET NULL)

### 3. Tabla nueva `public.cuentas_por_pagar`
Campos relevantes (sin listar id/created_at/updated_at):
- `company_id`, `obra_id` (nullable), `folio` (`CxP-YYYY-####`), `fecha_emision`, `fecha_vencimiento` (nullable)
- `beneficiario_tipo` (`trabajador` | `tercero`), `beneficiario_id`, `beneficiario_nombre` (snapshot)
- `concepto`, `origen_tipo` (`destajo_estimacion` por ahora; abierto a otros), `origen_id`
- `monto_total`, `monto_pagado` (default 0), `saldo` (generated column = total - pagado)
- `estatus`: `pendiente` | `parcial` | `pagada` | `cancelada`
- `creado_por`, `cancelado_at`, `cancelado_por`, `cancelacion_motivo`

GRANTs a `authenticated` + `service_role`; RLS: director o administrativo gestiona, miembros de obra pueden ver los de su obra.

Función SQL `siguiente_folio_cxp(_company_id uuid)` análoga a las existentes.

### 4. Extender `pagos`
- Agregar `cxp_id uuid` nullable, FK a `cuentas_por_pagar` ON DELETE SET NULL.
- (El check de `origen_tipo` ya incluye `'destajo'`; lo seguimos usando.)

### 5. Asiento contable al autorizar
Origen: `origen_tipo='destajo_estimacion'`, `origen_id=estimacion.id`. Cuentas hardcodeadas:
- Cargo `Costo de obra - Destajos` por **bruto**.
- Abono `Anticipos a contratistas` por **amortización_anticipo** (recupera anticipo).
- Abono `Fondo de garantía retenido` por **retención_fondo**.
- Cargo `Fondo de garantía retenido` por **liberación_fondo** (si > 0).
- Abono `Cuentas por pagar - Contratistas destajo` por **monto_neto** (= total del CxP).

Suma cargos = suma abonos = `bruto + liberacion`.

---

## Cambios en server functions (`src/lib/api/destajos.functions.ts`)

### Modificar `cerrarEstimacionDestajo`
- Sigue calculando amortización, retención, liberación, neto y poniendo `estatus='cerrada'`.
- **Elimina** cualquier generación de pago/asiento (hoy no genera asiento; confirmar que no toca `pagos` en este punto — la creación de pagos sigue viva sólo dentro del nuevo flujo).

### Nueva `autorizarEstimacionDestajo({ id })`
- Permisos: `is_director_of(company_id)` **o** `is_supervisor_de_obra(obra_id)`.
- Valida `estatus='cerrada'`.
- Crea CxP (`origen_tipo='destajo_estimacion'`, beneficiario = contratista del destajo, `monto_total=monto_neto`, folio via `siguiente_folio_cxp`).
- Inserta los renglones de `asientos_contables` (mismo `asiento_id` UUID).
- Actualiza estimación: `estatus='autorizada'`, `autorizada_at`, `autorizada_por`, `cxp_id`.

### Nueva `rechazarEstimacionDestajo({ id, motivo })`
- Mismos permisos.
- Valida `estatus='cerrada'`.
- `estatus='rechazada'`, guarda motivo/usuario/fecha. No genera CxP ni asiento.

### Nueva `reabrirEstimacionRechazada({ id })`
- Permisos: residente/miembro de obra.
- Valida `estatus='rechazada'`. Vuelve a `borrador` para recapturar.

### Mover el pago del contratista a Cuentas por Pagar
- El bloque actual que crea `pagos` con `origen_tipo='destajo'` queda como **pago contra CxP**: pide `cxp_id`, valida que el CxP esté `pendiente`/`parcial`, suma a `monto_pagado`, actualiza `estatus` del CxP (`parcial` o `pagada`), y si queda saldado pone la estimación en `pagada`.
- Cancelar un pago revierte `monto_pagado` y el estatus del CxP/estimación.

---

## Cambios de UI

### `CapturaEstimacionDestajoSheet.tsx`
- El botón **"Guardar y cerrar semana"** mantiene su confirm dialog actual, pero el texto deja claro que **sólo congela la semana y la envía al supervisor para autorización**.
- Si la estimación está `cerrada`/`autorizada`/`pagada`/`rechazada`: la hoja se abre en modo lectura (inputs deshabilitados). En `rechazada` se muestra el motivo y un botón "Reabrir para corregir" (llama `reabrirEstimacionRechazada`).

### Vista de la estimación (módulo destajos de la obra)
- Badge de estatus con los nuevos valores.
- Cuando `estatus='cerrada'`: si el usuario es supervisor de la obra o director, mostrar dos botones: **Autorizar** y **Rechazar** (este último abre un dialog pidiendo motivo).
- Cuando `estatus='autorizada'` o `pagada`: enlace al CxP generado (folio + saldo).

### (Fuera de alcance de este plan, queda como siguiente paso)
- Bandeja de Cuentas por Pagar para administrativo (listar, filtrar por contratista/obra, registrar pago contra CxP). En este plan sólo se crea la tabla y server fns mínimas (`getCxPById`); la pantalla completa la haremos después.

---

## Detalles técnicos

- **Migración** crea enum values nuevos, columnas, tabla `cuentas_por_pagar`, GRANTs, RLS, función `siguiente_folio_cxp`, índice por `(origen_tipo, origen_id)` y por `(company_id, estatus)`.
- `saldo` se implementa como `GENERATED ALWAYS AS (monto_total - monto_pagado) STORED`.
- Permisos para autorizar usan funciones SECURITY DEFINER ya existentes (`is_director_of`, `is_supervisor_de_obra`).
- Asiento se inserta como múltiples renglones compartiendo `asiento_id` (patrón ya usado por la tabla — un asiento_id agrupa cargos/abonos).
- Server functions nuevas usan `requireSupabaseAuth` + `supabaseAdmin` para el insert atómico (CxP + asiento + update estimación) envuelto en try/catch con rollback manual si algún paso falla.
- `pagos.cxp_id` permite que pagos parciales sigan apuntando al CxP; el estatus `pagada` en estimación se prende cuando el CxP queda saldado.

---

## Alcance

**Incluido**: migración, server fns de autorizar/rechazar/reabrir, refactor de pagos para ligar a CxP, UI mínima de autorización/rechazo en la vista de estimaciones del módulo destajos, modo lectura en el sheet.

**No incluido** (siguiente plan): pantalla completa de Cuentas por Pagar para el administrativo, reportes contables, edición/cancelación de asientos, catálogo de cuentas configurable.