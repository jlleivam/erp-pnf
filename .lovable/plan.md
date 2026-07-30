# Módulo "Gastos de obra"

Nuevo módulo dentro de cada obra para que el residente solicite al administrativo el pago de facturas o notas que no pasaron por requisición, subcontrato, destajo o caja chica. El supervisor autoriza y, una vez autorizado, el gasto entra automáticamente a Cuentas por pagar del administrativo.

## Flujo

```text
Residente captura        Supervisor           Administrativo
solicitud de gasto  -->  autoriza/rechaza --> CxP (pendiente de pago)
                             |
                             +--> si es material: entra al almacén de la semana
```

Estados: borrador (opcional) → solicitado → autorizado / rechazado → pagado (al liquidar la CxP).

## Captura de la solicitud

El residente elige el tipo:

- **Servicio / gasto directo** (ej. visita de topografía): concepto, proveedor, monto. No toca almacén; impacta directo al costo de la obra.
- **Material** (ej. viaje de arena): además captura partidas de insumos (insumo, cantidad, precio unitario). Al autorizarse, las partidas se registran como recepción en la semana de almacén abierta de la obra, igual que una recepción de orden de compra.

Campos comunes:

- Proveedor: sólo del catálogo de terceros (con el atajo existente para solicitar alta si no existe).
- Tipo de comprobante: factura / nota / ninguno.
- **Archivo de comprobante obligatorio cuando el tipo es "factura"**; opcional en nota o ninguno.
- Fecha, concepto, notas, monto total (calculado desde partidas cuando es material).

## Autorización

- Sólo quien tenga el permiso de autorizar (por defecto supervisor; director con bypass) ve los botones de autorizar/rechazar.
- El residente no puede autorizar su propia solicitud.
- Rechazo requiere motivo y regresa la solicitud al residente para editarla y reenviarla.
- Notificaciones: al supervisor cuando se solicita; al residente cuando se autoriza o rechaza; al administrativo cuando entra a CxP.

## Cuentas por pagar

Al autorizarse se genera una CxP con folio propio, beneficiario = proveedor, obra asignada y concepto del gasto. Aparece en el módulo de CxP del administrativo junto con el resto y se paga con el flujo de pago existente. Si el material fue a almacén, la CxP y el movimiento de almacén quedan ligados a la misma solicitud para trazabilidad.

## Permisos (nueva sección "Gastos de obra")

- Crear/editar y enviar solicitud — residente por defecto.
- Autorizar/rechazar solicitud — supervisor por defecto.
- Cancelar solicitud autorizada (antes de pagarse) — administrativo.
- Ver módulo — equipo de obra, administrativo, director.

## Detalles técnicos

- Migración: tablas `obra_gastos_directos` (company_id, obra_id, folio, tipo servicio/material, proveedor_id, concepto, tipo_comprobante, comprobante_path, monto_total, estatus, motivo_rechazo, solicitado_por/at, autorizado_por/at, cxp_id, recepcion_id, timestamps) y `obra_gasto_directo_partidas` (insumo_id, cantidad, precio_unitario). GRANTs + RLS por membresía de obra / compañía, trigger `updated_at` y función de folio `GD-YYYY-NNNN`.
- Bucket privado de storage para los comprobantes, con políticas por compañía.
- `src/lib/api/gastos-obra.functions.ts`: crear, actualizar, enviar, autorizar (crea CxP con `origen_tipo = 'gasto_obra'` y, si aplica, la recepción de almacén de la semana abierta), rechazar, cancelar. Todas con `requirePermission`.
- UI: `src/components/gastos-obra/GastosObraModule.tsx` + sheet de captura; ruta bajo `app.obras.$obraId.$` y entrada en el sidebar de obra en `AppShell.tsx` con globo de pendientes.
- Extender el catálogo de permisos y el mapeo de `origen_tipo` en `pagos.functions.ts` para el nuevo origen.
