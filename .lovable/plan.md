## Fase 1 — Catálogo de Cuentas (Configuración › Cuentas)

Alta y administración de cuentas con saldo inicial, dentro de Configuración de empresa.

### 1. Migración de BD

**Tabla `cuentas`**
- `id`, `company_id` (FK companies, NOT NULL), `nombre` (text, NOT NULL), `tipo` (`bancaria` | `caja_fuerte`), `moneda` (text default `'MXN'`), `banco` (text, null), `numero_cuenta` (text, null), `clabe` (text, null), `saldo_inicial` (numeric(14,2) NOT NULL default 0), `saldo_actual` (numeric(14,2) NOT NULL default 0), `activa` (bool default true), `notas` (text), `created_by`, `created_at`, `updated_at`.
- CHECK: `tipo IN ('bancaria','caja_fuerte')`. Si `tipo='caja_fuerte'` → `numero_cuenta` y `clabe` deben ser null (validación en server fn, no CHECK).

**Tabla `cuenta_movimientos`** (libro mayor; base para Fase 2+)
- `id`, `cuenta_id` (FK cuentas ON DELETE RESTRICT), `company_id`, `fecha` (date NOT NULL default today), `tipo` (`ingreso` | `egreso`), `monto` (numeric(14,2) NOT NULL, > 0), `concepto` (text), `referencia` (text, null), `origen` (`apertura` | `ajuste` | `pago` | `traspaso` | `ingreso_manual`), `origen_id` (uuid, null — usado en fases posteriores), `creado_por`, `created_at`.
- Índice por `(cuenta_id, fecha desc)`.

**GRANTs + RLS**
- `GRANT SELECT, INSERT, UPDATE, DELETE ON public.cuentas TO authenticated; GRANT ALL TO service_role;` (igual para `cuenta_movimientos`).
- Políticas:
  - `cuentas` SELECT: director y administrativo de la company.
  - `cuentas` INSERT/UPDATE/DELETE: solo director (`has_role(auth.uid(), company_id, 'director')`).
  - `cuenta_movimientos` SELECT: director y administrativo.
  - `cuenta_movimientos` INSERT/UPDATE/DELETE: solo via server functions con service_role (políticas restrictivas; UI no inserta directo).
- Trigger `update_updated_at_column` en `cuentas`.

### 2. Server functions (`src/lib/api/cuentas.functions.ts`)

Todas con `requireSupabaseAuth` + verificación de rol director donde aplique:

- `listCuentas()` — lista cuentas de la company del usuario (director y administrativo).
- `getCuenta(id)` — detalle + últimos movimientos.
- `crearCuenta({ nombre, tipo, banco?, numero_cuenta?, clabe?, saldo_inicial, notas? })` — solo director. Inserta cuenta y, si `saldo_inicial > 0`, inserta movimiento de apertura tipo `ingreso` con `origen='apertura'`. Setea `saldo_actual = saldo_inicial`.
- `actualizarCuenta(id, patch)` — solo director. No permite editar `saldo_inicial` ni `saldo_actual` (esos solo cambian vía movimientos).
- `desactivarCuenta(id)` / `activarCuenta(id)` — solo director.
- `listMovimientos(cuentaId, { from?, to? })` — director y administrativo.

Usa `supabaseAdmin` dentro del handler (cargado con `await import`) para el INSERT del movimiento de apertura atómico con la cuenta, validando rol antes.

### 3. UI — Pestaña "Cuentas" en Configuración

**Archivo nuevo:** `src/components/configuracion/CuentasTab.tsx`

- Tabla con columnas: Nombre, Tipo (badge bancaria/caja fuerte), Banco, Saldo actual, Estado (activa/inactiva), acciones (Editar, Desactivar).
- Botón "Nueva cuenta" → modal/sheet con formulario:
  - Tipo (radio): Bancaria | Caja fuerte.
  - Nombre (requerido).
  - Si bancaria: Banco, Número de cuenta, CLABE (opcionales).
  - Saldo inicial (numérico, default 0).
  - Notas.
- Click en fila → sheet de detalle con datos + tabla de movimientos (solo apertura por ahora; en Fase 2 se llenan con pagos).
- Editar abre el mismo formulario sin permitir cambiar saldo inicial.

**Modificar:** `src/routes/_authenticated/app.configuracion.tsx`
- Agregar `<TabsTrigger value="cuentas">Cuentas</TabsTrigger>` después de Equipo.
- `<TabsContent value="cuentas">` con `<CuentasTab />`.
- Como toda la página ya está gateada por `useEffectiveIsDirector`, no hay riesgo de fuga. La validación de rol también vive en server fn.

### 4. Formato

- Usar `formatMoneda` existente para saldos.
- Saldo en rojo si negativo (no debería suceder en Fase 1, preparado para fases futuras).

### 5. Fuera de alcance (Fase 1)

- Registrar pagos (Fase 2 — OC).
- Traspasos entre cuentas (Fase 5).
- Reportes / estado de cuenta exportable (Fase 5).
- Multi-moneda real (se guarda `moneda` pero sin conversión).
- Item de menú top-level "Finanzas" — se agregará cuando entremos a pagos.

### Resumen de archivos

- **Migración BD:** crear `cuentas`, `cuenta_movimientos`, GRANTs, RLS.
- **Nuevo:** `src/lib/api/cuentas.functions.ts`
- **Nuevo:** `src/components/configuracion/CuentasTab.tsx` (+ subcomponentes form y detalle).
- **Editado:** `src/routes/_authenticated/app.configuracion.tsx` (agregar pestaña).