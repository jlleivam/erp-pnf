# Módulo de Rentas

Replica el patrón de Destajos/Subcontratos (a nivel obra) pero orientado a equipos rentados con cobro periódico prorrateado y control de vencimiento.

## Flujo

1. **Residente** crea solicitud: equipo, cantidad, periodicidad sugerida, fecha estimada de inicio, notas.
2. **Administrativo** cotiza: selecciona **proveedor** del catálogo de terceros (categoría `proveedor` o `ambos`), captura tarifa, periodicidad (diaria / semanal / quincenal / mensual), depósito, condiciones.
3. **Supervisor** autoriza o rechaza la cotización.
4. **Residente** marca **fecha de llegada real** — desde ese día corre el contador de renta.
5. Durante la vigencia el residente puede:
   - Registrar eventos de **avería / inactividad** (bitácora con fecha inicio, fecha fin, motivo, foto opcional). No descuenta el cobro pero queda como soporte para reclamar al proveedor.
   - **Renovar** (extender fecha fin) → requiere autorización del supervisor de nuevo.
   - **Devolver** (cerrar la renta) → captura fecha de devolución real, congela cobro acumulado.
6. Sistema dispara **alertas** N días antes del vencimiento al residente y supervisor.

## Estatus de la renta

`borrador → cotizada → autorizada → rechazada → activa (al marcar llegada) → por_vencer → devuelta`

Renovaciones generan un sub-documento con su propio ciclo `pendiente → autorizada/rechazada`.

## Base de datos (nueva migración)

- `obra_rentas` — `obra_id`, `company_id`, `proveedor_id` (FK `terceros`), `numero`, `equipo` (texto), `cantidad`, `descripcion`, `periodicidad` (enum `diaria|semanal|quincenal|mensual`), `tarifa_unitaria`, `deposito`, `fecha_estimada_inicio`, `fecha_llegada_real`, `fecha_fin_programada`, `fecha_devolucion_real`, `estatus` (enum nuevo `renta_estatus`), `dias_aviso_vencimiento` (default 3), `creado_por`, `cotizado_por`, `autorizado_por`, `rechazado_por`, `rechazo_motivo`, timestamps.
- `obra_renta_renovaciones` — `renta_id`, `numero`, `fecha_fin_nueva`, `tarifa_nueva` (opcional), `estatus` (`pendiente|autorizada|rechazada`), `solicitado_por`, `autorizado_por`, `rechazado_por`, `rechazo_motivo`, timestamps.
- `obra_renta_eventos` — `renta_id`, `tipo` (`averia|inactividad|nota`), `fecha_inicio`, `fecha_fin`, `descripcion`, `evidencia_url` (opcional), `creado_por`, `created_at`. Bitácora, sin afectar cobro.
- `obra_renta_pagos` — `renta_id`, `periodo_inicio`, `periodo_fin`, `monto`, `pagado_at`, `referencia`, `creado_por`. Registro de pagos efectuados (informativo; el prorrateo se calcula al vuelo desde `fecha_llegada_real` + `periodicidad` + `tarifa`).

Enum nuevo: `renta_estatus` (`borrador, cotizada, autorizada, rechazada, activa, por_vencer, devuelta`).
Enum nuevo: `renta_periodicidad` (`diaria, semanal, quincenal, mensual`).

Para cada tabla: `GRANT … TO authenticated` + `service_role`, RLS habilitado y políticas equivalentes a Destajos:
- Lectura: miembros de la compañía.
- Residente (miembro de obra) crea solicitud y eventos, marca llegada/devolución/renovación.
- Administrativo cotiza (rol `administrativo`).
- Supervisor autoriza/rechaza (rol `supervisor`).
- Director hace todo.

## Backend — `src/lib/api/rentas.functions.ts`

- `listRentas(obraId)` — devuelve rentas con `proveedor_nombre`, `dias_acumulados`, `monto_acumulado`, `dias_restantes`.
- `getRenta(id)` — header + renovaciones + eventos + pagos.
- `crearSolicitudRenta` (residente) — estatus `borrador`.
- `cotizarRenta` (administrativo) — captura proveedor/tarifa/periodicidad → `cotizada`.
- `autorizarRenta` / `rechazarRenta` (supervisor) → `autorizada` / `rechazada`.
- `marcarLlegada(rentaId, fechaLlegada, fechaFinProgramada)` → `activa`.
- `solicitarRenovacion` / `autorizarRenovacion` / `rechazarRenovacion`.
- `marcarDevolucion(rentaId, fecha)` → `devuelta`.
- `registrarEvento` / `listEventos`.
- `registrarPago` / `listPagos`.
- Helper de prorrateo: dado periodicidad + tarifa + fecha llegada + fecha actual (o devolución), regresa periodos transcurridos y monto acumulado.

## Frontend — `src/components/rentas/`

- `RentasModule.tsx` — tabla con columnas #, Equipo, Proveedor, Estatus, Llegada, Vence, Acumulado, Acciones. KPIs: **Rentas activas**, **Acumulado del mes**, **Próximas a vencer** (≤ días aviso).
- `NuevaRentaDialog.tsx` — formulario simple del residente (equipo, cantidad, fecha estimada, notas).
- `RentaDetalleSheet.tsx` — header con datos + estatus, pestañas:
  - **Cotización** (captura del administrativo + botones autorizar/rechazar del supervisor).
  - **Vigencia** (marcar llegada, renovar, devolver, fechas y monto acumulado).
  - **Bitácora** (eventos de avería/inactividad).
  - **Pagos** (registro informativo).
- `CotizarRentaDialog.tsx`, `MarcarLlegadaDialog.tsx`, `RenovarRentaDialog.tsx`, `DevolverRentaDialog.tsx`, `RegistrarEventoDialog.tsx`, `RegistrarPagoDialog.tsx`.
- Banner amarillo en cabecera cuando `dias_restantes <= dias_aviso_vencimiento`.

## Notificaciones

Al cambiar a `cotizada` → notificar al supervisor. Al `autorizada/rechazada` → notificar al residente. Al cruzar el umbral de aviso (calculado en `listRentas` y mostrado en KPI; alerta visual por ahora, sin cron job).

## Routing

En `src/routes/_authenticated/app.obras.$obraId.$.tsx` añadir:
```ts
if (slug === "rentas") return <RentasModule obraId={obraId} />;
```
(El slug y label ya existen en `LABELS`.)

## Fuera de alcance

- Cron job real para enviar notificaciones automáticas de vencimiento (por ahora solo bandera visual en UI/KPI).
- Descuento automático del cobro por tiempo inactivo (acordamos: solo bitácora).
- Módulo admin global de rentas (`/app/admin/rentas` queda como placeholder).
