## Pagos de renta: la mejor manera

Hoy los pagos viven aislados (tabla `obra_renta_pagos`, formulario manual, sin afectar bancos ni contabilidad). El resto del sistema (subcontratos, OC, destajos) ya tiene un flujo canónico: **CxP → pago bancario → movimiento de cuenta → asiento contable**. La propuesta es alinear rentas a ese mismo flujo, con generación automática por periodicidad.

### Modelo conceptual

Una renta activa **devenga** cargo periodo a periodo según su `periodicidad` (diaria/semanal/quincenal/mensual). Cada periodo se materializa como una **CxP** al proveedor, que el administrativo paga con el flujo estándar del módulo de Pagos.

```text
Renta activa
   │
   │  cron diario + al cambiar estatus
   ▼
Genera periodos devengados ──► CxP (1 por periodo, folio CxP-YYYY-####)
                                    │
                                    │  Administrativo paga
                                    ▼
                       registrarPagoCxP (ya existe)
                          ├── pagos
                          ├── cuenta_movimientos
                          ├── asientos_contables
                          └── obra_renta_pagos (vínculo)
```

### Reglas de devengo

- Inicio: `fecha_llegada_real`. Cierre: `fecha_devolucion_real` o "hoy".
- Cada periodo cerrado genera **una** CxP con `origen_tipo = 'renta_periodo'`, `origen_id = obra_renta_pagos.id`, fecha_vencimiento = fin del periodo + N días (configurable por renta, default 15).
- Monto = `tarifa_unitaria × cantidad × días_del_periodo / días_por_periodicidad`. Periodos incompletos (último periodo abierto, devolución a mitad de mes) se prorratean.
- Si hay un evento de **inactividad** que cubre todo el periodo, no se genera CxP. Si lo cubre parcialmente, se descuenta esa fracción.
- Renovación con tarifa nueva ⇒ la tarifa nueva aplica desde la fecha de la renovación.
- Idempotente: la generación usa una clave única `(renta_id, periodo_inicio, periodo_fin)` en `obra_renta_pagos`, así correr el cron dos veces no duplica.

### Permisos

- **Generar** periodos: sistema (cron) + on-demand desde el detalle (botón "Recalcular periodos") visible para administrativo/director.
- **Registrar pago** (marcar CxP como pagada): **solo administrativo y director**. Se quita el botón "Registrar pago" del residente/supervisor.
- **Eliminar** pago: solo director (igual que en el resto del sistema).

### Cambios técnicos

**Base de datos** (una migración)
- `obra_renta_pagos`: agregar `cxp_id uuid null references cuentas_por_pagar`, `estatus text default 'pendiente' check in ('pendiente','pagado','cancelado')`, `dias_vencimiento int default 15`. Hacer `pagado_at` nullable, `monto` editable. Índice único `(renta_id, periodo_inicio, periodo_fin)`.
- `cuentas_por_pagar.origen_tipo`: aceptar el nuevo valor `'renta_periodo'` (es text, sin cambio de schema).
- Función `public.generar_periodos_renta(_renta_id uuid)` (security definer): calcula y hace upsert de los periodos devengados de una renta.
- Función `public.generar_periodos_rentas_activas()`: itera todas las rentas `activa` de todas las empresas y llama a la anterior. Se invoca por cron.

**Backend (`src/lib/api/rentas.functions.ts`)**
- Nueva `recalcularPeriodos({ rentaId })` — administrativo/director. Llama a la RPC `generar_periodos_renta`.
- Modificar `registrarPago` para que reciba un `pagoId` (periodo ya devengado) + `cuentaId/fecha/metodo/referencia`, y delegue en el flujo de `registrarPagoCxP` (creando la CxP on-demand si todavía no existe). Restringir a administrativo/director.
- `eliminarPago`: solo director, y solo si la CxP no tiene pagos aplicados.
- `getRenta`: devolver cada pago con su `cxp` (folio, estatus, saldo) y `estatus_periodo` (pendiente/pagado/parcial).

**Cron** (`src/routes/api/public/hooks/devengar-rentas.ts` + pg_cron)
- Endpoint público que llama a `generar_periodos_rentas_activas`. pg_cron diario 06:00. Auth con `apikey` (anon).

**UI (`RentaDetalleSheet.tsx`, pestaña Pagos)**
- Tabla de **periodos devengados** (no de "pagos manuales"): columnas Periodo, Monto, Vence, CxP, Estatus, Acción.
- Acción "Pagar" en cada renglón pendiente → abre `RegistrarPagoCxPDialog` ya existente, prellenado con monto pendiente y CxP.
- Resumen: Devengado, Pagado, Por pagar, Vencido.
- Botón "Recalcular periodos" (admin/director) para forzar regeneración manual.
- Esconder por completo el botón "Registrar pago" del flujo viejo para residente/supervisor.

### Por qué este diseño

- **Una sola verdad de cobros**: tesorería ve las CxP de renta junto a las de subcontratos y OC, con el mismo folio, los mismos reportes de antigüedad y el mismo flujo de pago.
- **Sin doble captura**: el admin no decide periodo ni monto, solo marca "ya pagué". Menos errores.
- **Auditable**: cada periodo es un renglón con su CxP, su asiento y su movimiento bancario.
- **Cubre los casos raros**: inactividad, renovaciones a mitad de mes y devolución parcial se reflejan automáticamente en el devengo.

### Fuera de alcance (próximas iteraciones)

- Conciliación automática con XML/PDF del proveedor.
- Notificación al admin cuando una CxP de renta vence.
- Reporte cross-obra de gasto de rentas por proveedor.
