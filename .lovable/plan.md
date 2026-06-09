## Objetivo

Agregar al destajo dos conceptos contractuales: **fondo de garantía** (retención por estimación, liberable parcialmente) y **anticipo** (pagado al inicio, amortizado proporcionalmente al avance de cada estimación). Sin estado de cuenta completo todavía.

## 1) Cambios de base de datos (migración)

### Tabla `obra_destajos` — nuevas columnas
- `anticipo_pct numeric not null default 0` (0–100)
- `anticipo_monto numeric not null default 0` (snapshot = monto_total × anticipo_pct/100; se recalcula al guardar)
- `fondo_garantia_pct numeric not null default 0` (0–100)

### Tabla `obra_destajo_estimaciones` — nuevas columnas (calculadas al cerrar la estimación)
- `monto_bruto numeric not null default 0` — avance valorizado de la semana
- `amortizacion_anticipo numeric not null default 0` — `monto_bruto × anticipo_pct/100`, topado al saldo pendiente del anticipo
- `retencion_fondo numeric not null default 0` — `monto_bruto × fondo_garantia_pct/100`
- `liberacion_fondo numeric not null default 0` — liberación manual capturada por el usuario en esa estimación (default 0)
- `monto_neto numeric` — `monto_bruto − amortizacion_anticipo − retencion_fondo + liberacion_fondo` (lo que ya existe como `monto_total` pasará a representar el neto pagable; se documenta y migra).

### Nueva tabla `obra_destajo_movimientos_anticipo` (opcional, simple)
Un solo registro tipo "pago de anticipo" por destajo:
- `destajo_id`, `company_id`, `fecha`, `monto`, `metodo_pago`, `referencia`, `creado_por`.
- Generado automáticamente al activar el destajo si `anticipo_monto > 0`.
- GRANT + RLS análogos a las otras tablas de destajo.

(No se crea aún tabla de "saldos"; los saldos se derivan por suma de columnas en las estimaciones.)

## 2) UI — Alta / edición de destajo (`NuevoDestajoSheet` / equivalente)

Nueva sección "Términos económicos" debajo de monto total:
- Switch "Requiere anticipo" → input % (0–100). Muestra preview en MXN: `monto_total × %`.
- Switch "Aplicar fondo de garantía" → input % (0–100). Muestra texto: "Se retendrá X% de cada estimación; podrás liberarlo parcialmente."
- Validaciones: 0 ≤ pct ≤ 100, dos decimales.

Al guardar: se persisten los % y se calcula `anticipo_monto` snapshot.

## 3) UI — Detalle del destajo

- Tarjetita informativa con: % anticipo, monto del anticipo, % fondo de garantía. Texto plano, sin KPIs de saldos.
- Cuando el destajo se "activa" (cambia de borrador a activo) y `anticipo_monto > 0`: crear automáticamente el movimiento de anticipo (estimación 0 / pago inicial). Se muestra en la lista de pagos del destajo como "Anticipo".

## 4) UI — Captura/cierre de estimación semanal

Al cerrar una estimación:
- Se calcula `monto_bruto` (como hoy).
- Se calcula automáticamente:
  - `amortizacion_anticipo = min(saldo_anticipo_pendiente, monto_bruto × anticipo_pct/100)` donde `saldo_anticipo_pendiente = anticipo_monto − Σ amortizacion_anticipo de estimaciones previas cerradas`.
  - `retencion_fondo = monto_bruto × fondo_garantia_pct/100`.
- Input opcional "Liberar fondo de garantía en esta estimación" (MXN, default 0, ≤ fondo retenido acumulado − ya liberado).
- Resumen visible: Bruto − Amortización anticipo − Retención fondo + Liberación fondo = **Neto a pagar**.

## 5) Server functions (`src/lib/api/destajos.functions.ts`)

- `createDestajo` / `updateDestajo`: aceptar y persistir `anticipo_pct`, `fondo_garantia_pct`; calcular `anticipo_monto`.
- `activateDestajo` (o donde se transicione a "activo"): insertar movimiento de anticipo si aplica.
- `closeEstimacion`: calcular `monto_bruto`, `amortizacion_anticipo`, `retencion_fondo`, aceptar `liberacion_fondo` del input, persistir `monto_neto`.
- Helper `getDestajoAnticipoSaldo(destajo_id)` para mostrar el saldo pendiente del anticipo durante la captura.

## Respuesta a "¿Necesitamos saldos como proveedores?"

Por ahora **no** se construye un estado de cuenta completo. Lo que se entrega es:
- Persistir los conceptos en cada estimación (bruto, amortización, retención, liberación, neto).
- Dejar la información lista para que en un siguiente paso se construya la vista de saldos (similar a proveedores) sumando esas columnas, sin necesidad de re-migrar datos.

## Fuera de alcance (siguiente iteración)

- Vista/tarjetas de "estado de cuenta del destajo" (contratado, anticipo pagado, anticipo amortizado, fondo retenido, fondo liberado, pagado, saldo).
- Reglas de bloqueo: no permitir cerrar el destajo si queda anticipo sin amortizar o fondo sin liberar.
- Reportes consolidados por obra.